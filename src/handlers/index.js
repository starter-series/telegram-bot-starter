const fs = require('fs');
const path = require('path');

// A conforming handler module exports a function `register(bot)` (see echo.js).
// Anything else (a stray helper file dropped in this dir, a module that forgot
// its exports) would otherwise crash boot with `handler.register is not a
// function`, so skip it loudly instead.
function isValidHandler(handler) {
  return (
    handler !== null &&
    typeof handler === 'object' &&
    typeof handler.register === 'function'
  );
}

function registerHandlers(bot) {
  const handlerFiles = fs
    .readdirSync(__dirname)
    .filter((file) => file !== 'index.js' && file.endsWith('.js'));

  for (const file of handlerFiles) {
    const handler = require(path.join(__dirname, file));
    if (!isValidHandler(handler)) {
      console.warn(
        `[handlers] Skipping ${file}: not a valid handler module ` +
          '(expected exports { register: function }).'
      );
      continue;
    }
    handler.register(bot);
  }
}

module.exports = { registerHandlers };
