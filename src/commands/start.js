const log = require('../lib/logger');

module.exports = {
  name: 'start',
  description: 'Start the bot',
  async execute(ctx) {
    try {
      await ctx.reply('Hello! I am a bot built with telegram-bot-starter. Type /help for commands.');
    } catch (err) {
      log.error('start', 'Failed to send reply', { error: String(err) });
    }
  },
};
