const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'help',
  description: 'List available commands',
  async execute(ctx) {
    const commandFiles = fs
      .readdirSync(__dirname)
      .filter((file) => file !== 'index.js' && file.endsWith('.js'));

    const commands = commandFiles.map((file) => {
      const cmd = require(path.join(__dirname, file));
      return `/${cmd.name} — ${cmd.description}`;
    });

    await ctx.reply(`Available commands:\n\n${commands.join('\n')}`);
  },
};
