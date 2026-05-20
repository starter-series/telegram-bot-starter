const { Bot, webhookCallback } = require('grammy');
const http = require('http');
const config = require('./config');
const { registerCommands } = require('./commands');
const { registerHandlers } = require('./handlers');
const { createHealthServer, createHealthHandler } = require('./lib/health');
const log = require('./lib/logger');

const bot = new Bot(config.botToken);

registerCommands(bot);
registerHandlers(bot);

bot.catch((err) => {
  log.error('bot', 'Unhandled error', { error: String(err) });
});

// Track servers for graceful shutdown. In polling mode we run a standalone
// health server; in webhook mode we mount /health on the webhook server and
// keep a single HTTP listener.
let webhookServer;
let healthServer;

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('lifecycle', 'Shutting down...', { signal });
  try {
    if (healthServer) await healthServer.stop();
  } catch (err) {
    log.error('lifecycle', 'Error closing health server', { error: String(err) });
  }
  try {
    if (webhookServer) {
      await new Promise((resolve) => webhookServer.close(() => resolve()));
    }
  } catch (err) {
    log.error('lifecycle', 'Error closing webhook server', { error: String(err) });
  }
  try {
    await bot.stop();
  } catch (err) {
    log.error('lifecycle', 'Error stopping bot', { error: String(err) });
  }
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Last-resort guards: `bot.catch()` covers grammy middleware errors, but
// anything thrown outside the bot's execution context (a stray async timer,
// the health server, the shutdown path itself) would otherwise terminate the
// process without a structured log line. Log + graceful shutdown so the
// readiness probe flips to 503 before the container exits, and so the log
// aggregator captures the cause instead of just an empty exit code.
process.on('uncaughtException', (err) => {
  log.error('process', 'uncaughtException', { error: String(err), stack: err?.stack });
  // Bound the shutdown path: if the runtime is corrupted, `bot.stop()` can
  // hang and the container would never exit. Force-kill after 5s so the
  // orchestrator (Docker / Fly / Railway) can restart us.
  setTimeout(() => process.exit(1), 5000).unref();
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  log.error('process', 'unhandledRejection', { reason: String(reason), stack: reason?.stack });
  // Do not shutdown — Node will eventually surface as uncaughtException if
  // the rejection is truly fatal. Logging is enough to find the bug.
});

if (config.webhookUrl) {
  // Webhook mode: mount GET /health on the same HTTP server as the webhook
  // handler so the container only exposes one port. Docker HEALTHCHECK and
  // Fly.io / Railway both hit /health on `config.port`.
  // `secretToken` makes grammy verify the X-Telegram-Bot-Api-Secret-Token
  // header on every incoming request. Without this, anyone who learns the
  // webhook URL (logs, screenshots, scans) can post forged updates.
  const handleWebhook = webhookCallback(bot, 'http', {
    secretToken: config.webhookSecret,
  });
  const requestHandler = createHealthHandler(bot, 'webhook', handleWebhook);

  webhookServer = http.createServer(requestHandler);
  webhookServer.on('error', (err) => {
    log.error('webhook', 'Server error', { error: String(err) });
  });
  webhookServer.listen(config.port, () => {
    log.info('webhook', `Webhook + health server running on port ${config.port}`);
  });

  bot.api.setWebhook(config.webhookUrl, {
    secret_token: config.webhookSecret,
  }).then(() => {
    log.info('webhook', `Webhook set to ${config.webhookUrl} (secret token enforced)`);
  }).catch((err) => {
    log.error('webhook', 'Failed to set webhook', { error: String(err) });
    process.exit(1);
  });
} else {
  // Polling mode: standalone health server on HEALTH_PORT. We start it in
  // parallel with bot.start() — readiness flips to 200 as soon as
  // `bot.isRunning()` is true (inside `bot.start()` before `onStart` fires).
  healthServer = createHealthServer(bot, { mode: 'polling' });
  healthServer.start().catch((err) => {
    log.error('health', 'Failed to start health server', { error: String(err) });
  });

  bot.start({
    onStart: () => log.info('polling', 'Bot started with long polling'),
  });
}
