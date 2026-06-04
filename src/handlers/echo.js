const log = require('../lib/logger');
const { createRateLimiter } = require('../lib/rate-limiter');
const { safeReply } = require('../lib/safe-reply');

const MAX_LENGTH = 4096;

/**
 * Truncate `text` to at most `max` UTF-16 code units without splitting a
 * surrogate pair. Telegram's 4096 limit is measured in code units, so we slice
 * by code units (not code points — `Array.from().slice(max)` can overshoot to
 * 2*max units for an all-emoji string and exceed the API limit). If the cut
 * lands between the high and low half of a surrogate pair, the trailing lone
 * high surrogate (U+D800–U+DBFF) is a malformed half-character; drop it so the
 * echoed text stays valid UTF-16 (a lone surrogate renders as U+FFFD).
 *
 * @param {string} text
 * @param {number} max - maximum UTF-16 code units.
 * @returns {string}
 */
function truncate(text, max) {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const lastCode = cut.charCodeAt(cut.length - 1);
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    // High surrogate at the tail: its low half was sliced off. Drop the orphan.
    cut = cut.slice(0, -1);
  }
  return cut;
}

// Per-user limiter. In-memory, so multi-process / multi-shard deploys lose
// state on restart and don't share counts across instances. For accurate
// limits in those topologies, swap the store for Redis.
const limiter = createRateLimiter(10, 60_000); // 10 messages / minute / user

module.exports = {
  name: 'echo',
  register(bot) {
    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (!text || text.trim().length === 0) return;
      // Skip commands so /start isn't echoed alongside the command's own reply.
      if (ctx.entities('bot_command').some((e) => e.offset === 0)) return;

      const userId = ctx.from?.id;
      if (userId === undefined) return; // Channel posts have no `from`; ignore.

      const { limited, retryAfterMs } = limiter.check(String(userId));
      if (limited) {
        log.warn('echo', 'rate-limited', { userId, retryAfterMs });
        // Don't reply — replying itself burns the user's outbound budget.
        return;
      }

      await safeReply(ctx, truncate(text, MAX_LENGTH));
    });
  },
};
