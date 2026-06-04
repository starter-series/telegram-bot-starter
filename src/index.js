const { Bot } = require('grammy');
const config = require('./config');
const { registerCommands } = require('./commands');
const { registerHandlers } = require('./handlers');
const log = require('./lib/logger');
const {
  selectTransport,
  buildShutdown,
  buildProcessGuards,
  buildWebhookTransport,
  buildPollingTransport,
} = require('./lib/lifecycle');

const bot = new Bot(config.botToken);

registerCommands(bot);
registerHandlers(bot);

bot.catch((err) => {
  log.error('bot', 'Unhandled error', { error: String(err) });
});

// Track servers for graceful shutdown. In polling mode we run a standalone
// health server; in webhook mode we mount /health on the webhook server and
// keep a single HTTP listener. They are assigned below, after the signal
// handlers are wired — `buildShutdown` reads them through getters so it sees
// whichever one the selected transport actually created.
let webhookServer;
let healthServer;

const shutdown = buildShutdown({
  getHealthServer: () => healthServer,
  getWebhookServer: () => webhookServer,
  bot,
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Last-resort guards: `bot.catch()` covers grammy middleware errors, but
// anything thrown outside the bot's execution context (a stray async timer,
// the health server, the shutdown path itself) would otherwise terminate the
// process without a structured log line. uncaughtException → log + graceful
// shutdown (so the readiness probe flips to 503 before the container exits);
// unhandledRejection → log + continue (Node escalates a truly fatal one to
// uncaughtException on its own).
buildProcessGuards({ shutdown });

if (selectTransport(config) === 'webhook') {
  webhookServer = buildWebhookTransport({ config, bot, shutdown });
} else {
  healthServer = buildPollingTransport({ bot, shutdown });
}
