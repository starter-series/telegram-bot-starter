const log = require('../lib/logger');

const MAX_LENGTH = 4096;

module.exports = {
  name: 'echo',
  register(bot) {
    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (!text || text.trim().length === 0) return;
      const reply = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text;
      try {
        await ctx.reply(reply);
      } catch (err) {
        log.error('echo', 'Failed to send reply', { error: String(err) });
      }
    });
  },
};
