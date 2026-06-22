const { Bot } = require('grammy');
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

function createBotRuntime(config, deps = {}) {
  const runtimeDeps = {
    BotClass: Bot,
    registerCommands,
    registerHandlers,
    selectTransport,
    buildShutdown,
    buildProcessGuards,
    buildWebhookTransport,
    buildPollingTransport,
    process,
    ...deps,
  };
  const {
    BotClass,
    registerCommands: registerCommandsFn,
    registerHandlers: registerHandlersFn,
    selectTransport: selectTransportFn,
    buildShutdown: buildShutdownFn,
    buildProcessGuards: buildProcessGuardsFn,
    buildWebhookTransport: buildWebhookTransportFn,
    buildPollingTransport: buildPollingTransportFn,
    process: processLike,
  } = runtimeDeps;

  const bot = new BotClass(config.botToken);

  registerCommandsFn(bot);
  registerHandlersFn(bot);

  bot.catch((err) => {
    log.error('bot', 'Unhandled error', { error: String(err) });
  });

  let webhookServer;
  let healthServer;

  const shutdown = buildShutdownFn({
    getHealthServer: () => healthServer,
    getWebhookServer: () => webhookServer,
    bot,
  });

  const runtime = {
    bot,
    shutdown,
    start() {
      processLike.on('SIGINT', () => shutdown('SIGINT'));
      processLike.on('SIGTERM', () => shutdown('SIGTERM'));
      buildProcessGuardsFn({ shutdown, proc: processLike });

      if (selectTransportFn(config) === 'webhook') {
        webhookServer = buildWebhookTransportFn({ config, bot, shutdown });
      } else {
        healthServer = buildPollingTransportFn({ bot, shutdown });
      }

      return runtime;
    },
    getHealthServer: () => healthServer,
    getWebhookServer: () => webhookServer,
  };

  return runtime;
}

module.exports = { createBotRuntime };
