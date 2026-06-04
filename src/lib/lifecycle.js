const http = require('http');
const { webhookCallback } = require('grammy');
const log = require('./logger');
const { createHealthServer, createHealthHandler } = require('./health');
const { buildStartupErrorHandler } = require('./startup-errors');

/**
 * Lifecycle wiring for the bot entry point, extracted from `src/index.js` so it
 * can be unit-tested without spinning grammY up against the live Telegram API.
 *
 * The entry point itself stays a thin assembly of these helpers; everything
 * with branching behavior (transport selection, shutdown ordering, the
 * process-level crash guards) lives here behind injectable seams.
 */

/**
 * Decide which transport to run from the resolved config.
 *
 * Webhook mode is selected iff a non-empty `webhookUrl` is configured; anything
 * falsy (unset, empty string) falls back to long-polling. This is the single
 * source of truth for the mode branch — `index.js` and the shutdown wiring both
 * consult it so they can never disagree about which server exists.
 *
 * @param {{ webhookUrl?: string }} config
 * @returns {'webhook' | 'polling'}
 */
function selectTransport(config) {
  return config.webhookUrl ? 'webhook' : 'polling';
}

/**
 * Build the graceful-shutdown function.
 *
 * Ordering is load-bearing and asserted by tests:
 *   1. health server first — flip the readiness probe to "down" (its listener
 *      stops answering) so the orchestrator stops routing new traffic before we
 *      tear anything else down,
 *   2. webhook server next — stop accepting inbound updates,
 *   3. `bot.stop()` last — drain grammY's in-flight update handling.
 * Then `process.exit(exitCode)`.
 *
 * Idempotent: concurrent SIGINT+SIGTERM (or a signal arriving mid-shutdown)
 * runs the teardown exactly once. Each step is individually guarded so one
 * server's close error cannot strand the remaining steps or the final exit.
 *
 * Servers are read through getters (not captured by value) because in the real
 * entry point `healthServer` / `webhookServer` are assigned *after* the signal
 * handlers are registered — capturing them eagerly would always see undefined.
 *
 * @param {object} deps
 * @param {() => (import('http').Server & { stop?: () => Promise<void> }) | undefined} deps.getHealthServer
 * @param {() => import('http').Server | undefined} deps.getWebhookServer
 * @param {{ stop: () => Promise<void> }} deps.bot
 * @param {(code: number) => void} [deps.exit] - test seam; defaults to process.exit.
 * @returns {(signal: string, exitCode?: number) => Promise<void>}
 */
function buildShutdown({ getHealthServer, getWebhookServer, bot, exit = (code) => process.exit(code) }) {
  let shuttingDown = false;
  return async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('lifecycle', 'Shutting down...', { signal, exitCode });

    const healthServer = getHealthServer();
    try {
      if (healthServer) await healthServer.stop();
    } catch (err) {
      log.error('lifecycle', 'Error closing health server', { error: String(err) });
    }

    const webhookServer = getWebhookServer();
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

    exit(exitCode);
  };
}

/**
 * Register the two process-level last-resort guards and return them so tests
 * can drive the handlers directly.
 *
 * `uncaughtException`: log, arm an unref'd force-kill timer (so a hung
 * `bot.stop()` can't keep the container alive forever), then start graceful
 * shutdown with exit code 1.
 *
 * `unhandledRejection`: log and *continue*. We deliberately do NOT shut down —
 * Node escalates a genuinely fatal rejection to `uncaughtException` on its own,
 * and tearing the worker down on every stray rejected promise would turn a
 * recoverable bug into an outage. The returned `onUnhandledRejection.shutsDown`
 * flag makes that decision an explicit, testable contract.
 *
 * @param {object} deps
 * @param {(signal: string, exitCode?: number) => void} deps.shutdown
 * @param {{ on: (event: string, handler: Function) => void }} [deps.proc] - defaults to `process`.
 * @param {number} [deps.forceExitMs] - force-kill deadline; defaults to 5000.
 * @returns {{ onUncaughtException: Function, onUnhandledRejection: Function }}
 */
function buildProcessGuards({ shutdown, proc = process, forceExitMs = 5000 }) {
  const onUncaughtException = (err) => {
    log.error('process', 'uncaughtException', { error: String(err), stack: err?.stack });
    // Bound the shutdown path: a corrupted runtime can hang `bot.stop()` and the
    // container would never exit. Force-kill after `forceExitMs` so the
    // orchestrator (Docker / Fly / Railway) can restart us. `.unref()` lets the
    // process exit earlier if graceful shutdown wins the race.
    setTimeout(() => proc.exit(1), forceExitMs).unref();
    shutdown('uncaughtException', 1);
  };

  const onUnhandledRejection = (reason) => {
    log.error('process', 'unhandledRejection', { reason: String(reason), stack: reason?.stack });
    // Intentionally no shutdown — see the function-level doc comment.
  };
  // Explicit, asserted contract: this handler does NOT trigger shutdown.
  onUnhandledRejection.shutsDown = false;

  proc.on('uncaughtException', onUncaughtException);
  proc.on('unhandledRejection', onUnhandledRejection);

  return { onUncaughtException, onUnhandledRejection };
}

/**
 * Build the webhook-mode HTTP server (webhook handler + mounted /health) and
 * register the webhook with Telegram.
 *
 * The `secret_token` passed to BOTH `webhookCallback` (which verifies the
 * `X-Telegram-Bot-Api-Secret-Token` header on every inbound request) and
 * `setWebhook` (which tells Telegram to send it) is what stops a forged-update
 * attack from anyone who learns the URL. Tests assert it is present and matches
 * `config.webhookSecret`.
 *
 * @param {object} deps
 * @param {{ webhookUrl: string, webhookSecret: string, port: number }} deps.config
 * @param {object} deps.bot
 * @param {(signal: string, exitCode?: number) => void} deps.shutdown
 * @param {typeof http} [deps.httpLib] - test seam.
 * @param {typeof webhookCallback} [deps.webhookCallbackFn] - test seam.
 * @returns {import('http').Server} the webhook server.
 */
function buildWebhookTransport({
  config,
  bot,
  shutdown,
  httpLib = http,
  webhookCallbackFn = webhookCallback,
}) {
  const handleWebhook = webhookCallbackFn(bot, 'http', {
    secretToken: config.webhookSecret,
  });
  const requestHandler = createHealthHandler(bot, 'webhook', handleWebhook);

  const webhookServer = httpLib.createServer(requestHandler);
  webhookServer.on('error', (err) => {
    log.error('webhook', 'Server error', { error: String(err) });
  });
  webhookServer.listen(config.port, () => {
    log.info('webhook', `Webhook + health server running on port ${config.port}`);
  });

  bot.api
    .setWebhook(config.webhookUrl, { secret_token: config.webhookSecret })
    .then(() => {
      log.info('webhook', `Webhook set to ${config.webhookUrl} (secret token enforced)`);
    })
    .catch(buildStartupErrorHandler('webhook', shutdown));

  return webhookServer;
}

/**
 * Build the polling-mode standalone health server and start long-polling.
 *
 * `bot.start()` is intentionally not awaited (it runs the long-poll loop for
 * the process lifetime) but its rejection is routed through `shutdown()` via
 * `buildStartupErrorHandler` so a startup failure (bad token, network down)
 * doesn't leak as an unhandledRejection or tear the health server mid-write.
 *
 * @param {object} deps
 * @param {object} deps.bot
 * @param {(signal: string, exitCode?: number) => void} deps.shutdown
 * @param {typeof createHealthServer} [deps.createHealthServerFn] - test seam.
 * @returns {import('http').Server & { start: Function, stop: Function }} the health server.
 */
function buildPollingTransport({ bot, shutdown, createHealthServerFn = createHealthServer }) {
  const healthServer = createHealthServerFn(bot, { mode: 'polling' });
  healthServer.start().catch((err) => {
    log.error('health', 'Failed to start health server', { error: String(err) });
  });

  bot
    .start({ onStart: () => log.info('polling', 'Bot started with long polling') })
    .catch(buildStartupErrorHandler('polling', shutdown));

  return healthServer;
}

module.exports = {
  selectTransport,
  buildShutdown,
  buildProcessGuards,
  buildWebhookTransport,
  buildPollingTransport,
};
