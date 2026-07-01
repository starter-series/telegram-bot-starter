const { GrammyError, HttpError } = require('grammy');
const log = require('./logger');
const { delay } = require('./timers');

/**
 * Send a reply that survives transient Telegram errors.
 *
 * - 429 (RetryAfter): wait the server-suggested seconds, retry once.
 *   We bound retries because the bot is single-process — looping forever
 *   on rate-limit blocks the event loop and starves other updates.
 * - Other GrammyError / HttpError: log and swallow. Failing to send a
 *   demo echo shouldn't crash the bot worker.
 *
 * Usage:
 *   await safeReply(ctx, "hello");
 */
async function safeReply(ctx, text, options) {
  try {
    return await ctx.reply(text, options);
  } catch (err) {
    if (err instanceof GrammyError && err.error_code === 429) {
      // `retry_after: 0` is a legitimate "retry immediately" signal from
      // Telegram — `|| 1` would coerce that valid 0 into a needless 1s stall.
      // Honor any finite non-negative value; fall back to 1s only for
      // missing / NaN / negative (malformed) payloads.
      const suggested = Number(err.parameters?.retry_after);
      const retryAfter = Number.isFinite(suggested) && suggested >= 0 ? suggested : 1;
      log.warn('safe-reply', 'rate-limited by Telegram, retrying once', { retryAfter });
      await delay(retryAfter * 1000);
      try {
        return await ctx.reply(text, options);
      } catch (retryErr) {
        log.error('safe-reply', 'retry failed', { error: String(retryErr) });
        return null;
      }
    }
    if (err instanceof HttpError) {
      log.error('safe-reply', 'network error', { error: String(err) });
      return null;
    }
    if (err instanceof GrammyError) {
      log.error('safe-reply', 'API error', {
        error_code: err.error_code,
        description: err.description,
      });
      return null;
    }
    // Non-Grammy errors used to rethrow, but the file's contract is
    // "failing to send a demo echo shouldn't crash the bot worker."
    // Log structurally and drop. If grammy ever changes its error
    // hierarchy, this prevents an unhandled rejection from killing the
    // event loop.
    log.error('safe-reply', 'unexpected error', {
      error: String(err),
      name: err?.name,
    });
    return null;
  }
}

module.exports = { safeReply };
