const fs = require('fs');
const path = require('path');

const commands = [];

// A conforming command module exports a non-empty string `name` and a function
// `execute` (see start.js / help.js). Anything else (a stray helper file dropped
// in this dir, a module that forgot its exports) would otherwise register
// `bot.command(undefined, undefined)` or crash boot, so skip it loudly.
function isValidCommand(command) {
  return (
    command !== null &&
    typeof command === 'object' &&
    typeof command.name === 'string' &&
    command.name.length > 0 &&
    typeof command.execute === 'function'
  );
}

function registerCommands(bot) {
  const commandFiles = fs
    .readdirSync(__dirname)
    .filter((file) => file !== 'index.js' && file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(__dirname, file));
    if (!isValidCommand(command)) {
      console.warn(
        `[commands] Skipping ${file}: not a valid command module ` +
          '(expected exports { name: string, execute: function }).'
      );
      continue;
    }
    commands.push(command);
    bot.command(command.name, command.execute);
  }
}

module.exports = { registerCommands, commands };
