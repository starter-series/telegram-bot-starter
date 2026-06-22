const { createBotRuntime } = require('../src/bootstrap');

function deps({ mode = 'polling' } = {}) {
  const bot = { catch: jest.fn(), stop: jest.fn() };
  const processLike = { on: jest.fn() };
  const shutdown = jest.fn();
  return {
    bot,
    processLike,
    shutdown,
    deps: {
      BotClass: jest.fn(() => bot),
      registerCommands: jest.fn(),
      registerHandlers: jest.fn(),
      selectTransport: jest.fn(() => mode),
      buildShutdown: jest.fn(() => shutdown),
      buildProcessGuards: jest.fn(),
      buildWebhookTransport: jest.fn(() => ({ kind: 'webhook-server' })),
      buildPollingTransport: jest.fn(() => ({ kind: 'health-server' })),
      process: processLike,
    },
  };
}

describe('createBotRuntime', () => {
  test('constructs the bot, registers commands/handlers, and installs bot.catch', () => {
    const cfg = { botToken: 'test-token', webhookUrl: '', webhookSecret: '', port: 3000 };
    const state = deps();

    const runtime = createBotRuntime(cfg, state.deps);

    expect(state.deps.BotClass).toHaveBeenCalledWith('test-token');
    expect(state.deps.registerCommands).toHaveBeenCalledWith(state.bot);
    expect(state.deps.registerHandlers).toHaveBeenCalledWith(state.bot);
    expect(state.bot.catch).toHaveBeenCalledTimes(1);
    expect(runtime.bot).toBe(state.bot);
  });

  test('starts polling mode without touching Telegram network in tests', () => {
    const cfg = { botToken: 'test-token', webhookUrl: '', webhookSecret: '', port: 3000 };
    const state = deps({ mode: 'polling' });

    const runtime = createBotRuntime(cfg, state.deps).start();

    expect(state.processLike.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(state.processLike.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(state.deps.buildProcessGuards).toHaveBeenCalledWith({
      shutdown: state.shutdown,
      proc: state.processLike,
    });
    expect(state.deps.buildPollingTransport).toHaveBeenCalledWith({
      bot: state.bot,
      shutdown: state.shutdown,
    });
    expect(state.deps.buildWebhookTransport).not.toHaveBeenCalled();
    expect(runtime.getHealthServer()).toEqual({ kind: 'health-server' });
  });

  test('starts webhook mode and exposes the webhook server to shutdown getters', () => {
    const cfg = {
      botToken: 'test-token',
      webhookUrl: 'https://bot.example.com/webhook',
      webhookSecret: 'secret',
      port: 3000,
    };
    const state = deps({ mode: 'webhook' });

    const runtime = createBotRuntime(cfg, state.deps).start();
    const shutdownArgs = state.deps.buildShutdown.mock.calls[0][0];

    expect(state.deps.buildWebhookTransport).toHaveBeenCalledWith({
      config: cfg,
      bot: state.bot,
      shutdown: state.shutdown,
    });
    expect(state.deps.buildPollingTransport).not.toHaveBeenCalled();
    expect(runtime.getWebhookServer()).toEqual({ kind: 'webhook-server' });
    expect(shutdownArgs.getWebhookServer()).toEqual({ kind: 'webhook-server' });
    expect(shutdownArgs.getHealthServer()).toBeUndefined();
  });

  test('signal handlers delegate to shutdown', () => {
    const cfg = { botToken: 'test-token', webhookUrl: '', webhookSecret: '', port: 3000 };
    const state = deps();

    createBotRuntime(cfg, state.deps).start();
    const sigint = state.processLike.on.mock.calls.find(([event]) => event === 'SIGINT')[1];
    const sigterm = state.processLike.on.mock.calls.find(([event]) => event === 'SIGTERM')[1];

    sigint();
    sigterm();

    expect(state.shutdown).toHaveBeenCalledWith('SIGINT');
    expect(state.shutdown).toHaveBeenCalledWith('SIGTERM');
  });
});
