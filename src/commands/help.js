const log = require('../lib/logger');
const { commands } = require('./index');

module.exports = {
  name: 'help',
  description: 'List available commands',
  async execute(ctx) {
    const list = commands
      .map((cmd) => `/${cmd.name} — ${cmd.description}`)
      .join('\n');
    try {
      await ctx.reply(`Available commands:\n\n${list}`);
    } catch (err) {
      log.error('help', 'Failed to send reply', { error: String(err) });
    }
  },
};
