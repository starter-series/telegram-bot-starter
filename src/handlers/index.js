const fs = require('fs');
const path = require('path');

function registerHandlers(bot) {
  const handlerFiles = fs
    .readdirSync(__dirname)
    .filter((file) => file !== 'index.js' && file.endsWith('.js'));

  for (const file of handlerFiles) {
    const handler = require(path.join(__dirname, file));
    handler.register(bot);
  }
}

module.exports = { registerHandlers };
