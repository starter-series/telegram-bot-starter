const http = require('http');
const log = require('./logger');

/**
 * Build a readiness snapshot for the given grammY bot.
 *
 * Polling mode uses `bot.isRunning()` — true once `bot.start()` has begun the
 * polling loop. Webhook mode uses `bot.isInited()` — true after the bot has
 * fetched its own identity, which happens before the first update is handled.
 *
 * @param {import('grammy').Bot} bot
 * @param {'polling' | 'webhook'} mode
 */
function snapshot(bot, mode) {
  const ready = mode === 'webhook' ? bot.isInited?.() ?? false : bot.isRunning?.() ?? false;
  return {
    ready,
    body: {
      status: ready ? 'ok' : 'starting',
      uptime: process.uptime(),
      mode,
    },
  };
}

/**
 * Build an HTTP request handler that answers `GET /health` with the bot's
 * readiness state and delegates everything else to `fallback` (or 404s).
 *
 * Mounting via fallback is what lets webhook mode share a single server with
 * grammY's `webhookCallback` instead of spawning a second HTTP listener.
 *
 * @param {import('grammy').Bot} bot
 * @param {'polling' | 'webhook'} mode
 * @param {import('http').RequestListener} [fallback]
 * @returns {import('http').RequestListener}
 */
function createHealthHandler(bot, mode, fallback) {
  return (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const { ready, body } = snapshot(bot, mode);
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }

    if (fallback) {
      fallback(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  };
}

/**
 * Create a standalone health-check HTTP server. Used in polling mode — webhook
 * mode should call `createHealthHandler` instead and mount it on the webhook
 * server so the container only exposes one port.
 *
 * GET /health:
 *   - 200 OK + JSON `{ status: "ok", uptime, mode }` when the bot is running.
 *   - 503 Service Unavailable + JSON `{ status: "starting", uptime, mode }`
 *     before the bot has started or after it disconnected.
 *
 * Any other path returns 404.
 *
 * @param {import('grammy').Bot} bot
 * @param {{ mode?: 'polling' | 'webhook', port?: number }} [options]
 */
function createHealthServer(bot, options = {}) {
  const mode = options.mode ?? 'polling';
  const port = options.port ?? (Number(process.env.HEALTH_PORT) || 3000);

  const server = http.createServer(createHealthHandler(bot, mode));

  server.on('error', (err) => {
    log.error('health', 'Health server error', { error: String(err) });
  });

  function start() {
    return new Promise((resolve) => {
      server.listen(port, () => {
        // Resolve the real port from the bound socket so `port: 0` (ephemeral,
        // used in tests) still shows a useful value in the log line.
        const bound = server.address()?.port ?? port;
        log.info('health', `Health server listening on :${bound}`, { mode });
        resolve(server);
      });
    });
  }

  function stop() {
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  server.start = start;
  server.stop = stop;
  return server;
}

module.exports = { createHealthServer, createHealthHandler };
