const { Bot } = require('grammy');
const config = require('./config');
const { registerCommands } = require('./commands');
const { registerHandlers } = require('./handlers');
const log = require('./lib/logger');

const bot = new Bot(config.botToken);

registerCommands(bot);
registerHandlers(bot);

bot.catch((err) => {
  log.error('bot', 'Unhandled error', { error: String(err) });
});

let server;

// Graceful shutdown
const shutdown = () => {
  log.info('lifecycle', 'Shutting down...');
  bot.stop();
  if (server) server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start with long polling (default) or webhook
if (config.webhookUrl) {
  const { webhookCallback } = require('grammy');
  const http = require('http');

  server = http.createServer(webhookCallback(bot, 'http'));
  server.on('error', (err) => {
    log.error('webhook', 'Server error', { error: String(err) });
  });
  server.listen(config.port, () => {
    log.info('webhook', `Webhook server running on port ${config.port}`);
  });

  bot.api.setWebhook(config.webhookUrl).then(() => {
    log.info('webhook', `Webhook set to ${config.webhookUrl}`);
  }).catch((err) => {
    log.error('webhook', 'Failed to set webhook', { error: String(err) });
    process.exit(1);
  });
} else {
  bot.start({
    onStart: () => log.info('polling', 'Bot started with long polling'),
  });
}
