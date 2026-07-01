const log = require('./logger');
const { clearTimer, setTimer } = require('./timers');

/**
 * Build a `.catch` handler for a startup-time async API call (`bot.start()`,
 * `bot.api.setWebhook()`, etc).
 *
 * The handler:
 *   1. logs structurally with the same shape as our other error sites,
 *   2. arms a 5-second force-kill timer in case `shutdown()` itself deadlocks
 *      (e.g. `bot.stop()` on a half-initialized client never resolves),
 *   3. asks the supplied `shutdown(signal, exitCode)` to close the health /
 *      webhook server and exit with code 1.
 *
 * Extracted from `src/index.js` so it can be exercised by tests — the entry
 * point itself is hard to drive without spinning up grammY against the live
 * Telegram API, but this helper is pure (modulo logger + setTimeout) and
 * fully unit-testable.
 *
 * @param {string} scope  - log namespace + signal prefix (`'polling'`, `'webhook'`).
 * @param {(signal: string, exitCode?: number) => void} shutdown
 * @param {{ forceExitMs?: number }} [opts] - test seam; production callers leave defaults.
 * @returns {(err: unknown) => void}
 */
function buildStartupErrorHandler(scope, shutdown, opts = {}) {
  const forceExitMs = opts.forceExitMs ?? 5000;
  return (err) => {
    log.error(scope, `Failed to start ${scope}`, {
      // Prefer `err.message` over `String(err)` so structured loggers don't
      // double the "Error: " prefix (it's already at the head of err.stack).
      error: err?.message ?? String(err),
      stack: err?.stack,
    });
    // Bound shutdown. If `bot.stop()` hangs on a half-initialized client the
    // orchestrator (Docker/Fly/Railway) must still be able to restart us.
    const forceExitTimer = setTimer(() => process.exit(1), forceExitMs);
    forceExitTimer.unref?.();
    Promise.resolve(shutdown(`${scope}-startup-failure`, 1)).finally(() => {
      clearTimer(forceExitTimer);
    });
  };
}

module.exports = { buildStartupErrorHandler };
