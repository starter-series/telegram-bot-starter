module.exports = {
  name: 'help',
  description: 'List available commands',
  async execute(ctx) {
    const { commands } = require('./index');
    const list = commands
      .map((cmd) => `/${cmd.name} — ${cmd.description}`)
      .join('\n');
    await ctx.reply(`Available commands:\n\n${list}`);
  },
};
