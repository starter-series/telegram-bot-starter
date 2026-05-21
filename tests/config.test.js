// Exercise the env-validation logic in src/config.js. The module fails fast
// with process.exit(1) on bad config; spy on exit so the test runner survives,
// and clear the require cache between tests so each load re-evaluates the
// module's top-level checks.

function loadConfig(env) {
  // jest has its own module registry — `delete require.cache[...]` is a no-op
  // here, so use `jest.resetModules()` to force a fresh evaluation that re-runs
  // the env-validation top-level code.
  jest.resetModules();
  const prev = { ...process.env };
  Object.keys(process.env).forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  try {
    return require('../src/config');
  } finally {
    Object.keys(process.env).forEach((k) => delete process.env[k]);
    Object.assign(process.env, prev);
  }
}

describe('config', () => {
  let exitSpy;
  let errorSpy;

  beforeEach(() => {
    // process.exit must not actually exit; record the calls instead.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('loads cleanly when BOT_TOKEN is set and no webhook is configured', () => {
    const cfg = loadConfig({ BOT_TOKEN: 'test-token-123' });
    expect(cfg.botToken).toBe('test-token-123');
    expect(cfg.webhookUrl).toBe('');
    expect(cfg.webhookSecret).toBe('');
    expect(cfg.port).toBe(3000);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('exits with code 1 when BOT_TOKEN is missing', () => {
    loadConfig({});
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  test('exits when WEBHOOK_URL is set but WEBHOOK_SECRET is missing', () => {
    // Without the secret token, anyone who learns the URL can forge updates.
    // config.js refuses to start in that posture.
    loadConfig({
      BOT_TOKEN: 'test-token',
      WEBHOOK_URL: 'https://bot.example.com/webhook',
      // WEBHOOK_SECRET omitted
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('accepts webhook mode when both URL and SECRET are provided', () => {
    const cfg = loadConfig({
      BOT_TOKEN: 'test-token',
      WEBHOOK_URL: 'https://bot.example.com/webhook',
      WEBHOOK_SECRET: 'a'.repeat(64),
    });
    expect(cfg.webhookUrl).toBe('https://bot.example.com/webhook');
    expect(cfg.webhookSecret).toHaveLength(64);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('parses PORT as an integer with default 3000', () => {
    expect(loadConfig({ BOT_TOKEN: 'x', PORT: '8080' }).port).toBe(8080);
    expect(loadConfig({ BOT_TOKEN: 'x', PORT: 'not-a-number' }).port).toBe(3000);
    expect(loadConfig({ BOT_TOKEN: 'x' }).port).toBe(3000);
  });
});
