const { GrammyError, HttpError } = require('grammy');
const log = require('./logger');

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
      const retryAfter = Number(err.parameters?.retry_after) || 1;
      log.warn('safe-reply', 'rate-limited by Telegram, retrying once', { retryAfter });
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
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
