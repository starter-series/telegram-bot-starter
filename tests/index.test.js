beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('entry point', () => {
  test('loads runtime config and starts the bot runtime', () => {
    const config = {
    botToken: 'tok',
      webhookUrl: '',
      webhookSecret: '',
    port: 3000,
    };
    const start = jest.fn();
    const createBotRuntime = jest.fn(() => ({ start }));
    jest.doMock('../src/config', () => config);
    jest.doMock('../src/bootstrap', () => ({ createBotRuntime }));

    require('../src/index');

    expect(createBotRuntime).toHaveBeenCalledWith(config);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
