const log = require('../lib/logger');
const { createRateLimiter } = require('../lib/rate-limiter');
const { safeReply } = require('../lib/safe-reply');

const MAX_LENGTH = 4096;

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

      const reply = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text;
      await safeReply(ctx, reply);
    });
  },
};
