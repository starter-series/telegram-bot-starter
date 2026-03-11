const { Bot } = require('grammy');
const config = require('./config');
const { registerCommands } = require('./commands');
const { registerHandlers } = require('./handlers');

const bot = new Bot(config.botToken);

registerCommands(bot);
registerHandlers(bot);

bot.catch((err) => {
  console.error('Bot error:', err);
});

let server;

// Graceful shutdown
const shutdown = () => {
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
  server.listen(config.port, () => {
    console.log(`Webhook server running on port ${config.port}`);
  });

  bot.api.setWebhook(config.webhookUrl).then(() => {
    console.log(`Webhook set to ${config.webhookUrl}`);
  }).catch((err) => {
    console.error('Failed to set webhook:', err);
    process.exit(1);
  });
} else {
  bot.start({
    onStart: () => console.log('Bot started with long polling'),
  });
}
