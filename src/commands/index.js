const fs = require('fs');
const path = require('path');

function registerCommands(bot) {
  const commandFiles = fs
    .readdirSync(__dirname)
    .filter((file) => file !== 'index.js' && file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(__dirname, file));
    bot.command(command.name, command.execute);
  }
}

module.exports = { registerCommands };
