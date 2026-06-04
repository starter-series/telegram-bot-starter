// Boot-wiring tests for the entry point (src/index.js). The file is pure glue —
// it constructs the Bot, registers commands/handlers, wires the signal handlers
// and process guards, then assigns the transport's server to the right
// `healthServer`/`webhookServer` slot. Requiring it runs all of that, so every
// collaborator is mocked: no real grammY client, no real HTTP listener, no
// process.exit. We then assert the branch decisions the entry point makes.

const SIGNAL_HANDLERS = {};
let realOn;

beforeAll(() => {
  realOn = process.on.bind(process);
});

beforeEach(() => {
  jest.resetModules();
  for (const k of Object.keys(SIGNAL_HANDLERS)) delete SIGNAL_HANDLERS[k];

  // Capture signal registrations from index.js without actually attaching them
  // to this jest process (which would leak across tests).
  jest.spyOn(process, 'on').mockImplementation((event, handler) => {
    if (event === 'SIGINT' || event === 'SIGTERM') {
      SIGNAL_HANDLERS[event] = handler;
      return process;
    }
    return realOn(event, handler);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockDeps({ webhookUrl = '' } = {}) {
  const bot = { catch: jest.fn(), api: {}, start: jest.fn(), stop: jest.fn() };
  jest.doMock('grammy', () => ({ Bot: jest.fn(() => bot) }));
  jest.doMock('../src/config', () => ({
    botToken: 'tok',
    webhookUrl,
    webhookSecret: webhookUrl ? 'secret' : '',
    port: 3000,
  }));

  const registerCommands = jest.fn();
  const registerHandlers = jest.fn();
  jest.doMock('../src/commands', () => ({ registerCommands, commands: [] }));
  jest.doMock('../src/handlers', () => ({ registerHandlers }));

  const shutdown = jest.fn();
  const lifecycle = {
    selectTransport: jest.fn((cfg) => (cfg.webhookUrl ? 'webhook' : 'polling')),
    buildShutdown: jest.fn(() => shutdown),
    buildProcessGuards: jest.fn(),
    buildWebhookTransport: jest.fn(() => ({ kind: 'webhook-server' })),
    buildPollingTransport: jest.fn(() => ({ kind: 'health-server' })),
  };
  jest.doMock('../src/lib/lifecycle', () => lifecycle);

  return { bot, registerCommands, registerHandlers, lifecycle, shutdown };
}

describe('entry point wiring', () => {
  test('registers commands and handlers and a bot.catch on the constructed Bot', () => {
    const { bot, registerCommands, registerHandlers } = mockDeps();
    require('../src/index');
    expect(registerCommands).toHaveBeenCalledWith(bot);
    expect(registerHandlers).toHaveBeenCalledWith(bot);
    expect(bot.catch).toHaveBeenCalledTimes(1);
  });

  test('the bot.catch handler logs grammy middleware errors to stderr', () => {
    const { bot } = mockDeps();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      require('../src/index');
      const handler = bot.catch.mock.calls[0][0];
      handler(new Error('middleware blew up'));
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Unhandled error'));
    } finally {
      errSpy.mockRestore();
    }
  });

  test('wires SIGINT and SIGTERM to the shutdown function', () => {
    const { shutdown } = mockDeps();
    require('../src/index');

    expect(typeof SIGNAL_HANDLERS.SIGINT).toBe('function');
    expect(typeof SIGNAL_HANDLERS.SIGTERM).toBe('function');

    SIGNAL_HANDLERS.SIGINT();
    expect(shutdown).toHaveBeenCalledWith('SIGINT');
    SIGNAL_HANDLERS.SIGTERM();
    expect(shutdown).toHaveBeenCalledWith('SIGTERM');
  });

  test('installs the process guards with the shutdown function', () => {
    const { lifecycle, shutdown } = mockDeps();
    require('../src/index');
    expect(lifecycle.buildProcessGuards).toHaveBeenCalledWith({ shutdown });
  });

  test('selects the WEBHOOK transport when config.webhookUrl is set', () => {
    const { lifecycle } = mockDeps({ webhookUrl: 'https://bot.example.com/hook' });
    require('../src/index');
    expect(lifecycle.buildWebhookTransport).toHaveBeenCalledTimes(1);
    expect(lifecycle.buildPollingTransport).not.toHaveBeenCalled();
  });

  test('selects the POLLING transport when config.webhookUrl is empty', () => {
    const { lifecycle } = mockDeps({ webhookUrl: '' });
    require('../src/index');
    expect(lifecycle.buildPollingTransport).toHaveBeenCalledTimes(1);
    expect(lifecycle.buildWebhookTransport).not.toHaveBeenCalled();
  });

  test('buildShutdown gets server getters that resolve to the created webhook server', () => {
    const { lifecycle } = mockDeps({ webhookUrl: 'https://bot.example.com/hook' });
    require('../src/index');

    // The getters are passed at buildShutdown time but must read the slot that
    // the transport assigns AFTERWARDS — assert they resolve post-assignment.
    const args = lifecycle.buildShutdown.mock.calls[0][0];
    expect(args.getWebhookServer()).toEqual({ kind: 'webhook-server' });
    expect(args.getHealthServer()).toBeUndefined();
  });

  test('buildShutdown getters resolve to the created health server in polling mode', () => {
    const { lifecycle } = mockDeps({ webhookUrl: '' });
    require('../src/index');
    const args = lifecycle.buildShutdown.mock.calls[0][0];
    expect(args.getHealthServer()).toEqual({ kind: 'health-server' });
    expect(args.getWebhookServer()).toBeUndefined();
  });
});
