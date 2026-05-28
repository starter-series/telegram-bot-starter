// Exercise the env-validation logic in src/config.js. The module fails fast
// with process.exit(1) on bad config; spy on exit so the test runner survives,
// and clear the require cache between tests so each load re-evaluates the
// module's top-level checks.
//
// `dotenv` is mocked at module scope so this suite is hermetic — a developer
// who follows the README quick-start (`cp .env.example .env`, fill in BOT_TOKEN)
// would otherwise see `dotenv.config()` repopulate BOT_TOKEN/PORT from disk
// between our `delete process.env[k]` step and the require, breaking the
// "exits when BOT_TOKEN is missing" and PORT-default tests locally even
// though CI (no .env on disk) passes.
jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

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

  describe('PORT parsing', () => {
    test('numeric string is parsed as an integer', () => {
      expect(loadConfig({ BOT_TOKEN: 'x', PORT: '8080' }).port).toBe(8080);
    });

    test('non-numeric string falls back to default 3000', () => {
      expect(loadConfig({ BOT_TOKEN: 'x', PORT: 'not-a-number' }).port).toBe(3000);
    });

    test('absent PORT falls back to default 3000', () => {
      expect(loadConfig({ BOT_TOKEN: 'x' }).port).toBe(3000);
    });

    test('PORT=0 is accepted (ephemeral-port request), NOT silently overridden by 3000', () => {
      // Common in test harnesses and some PaaS configurations: PORT=0 asks
      // the OS to assign an ephemeral free port. The previous
      // `parseInt(PORT, 10) || 3000` collapsed 0 → 3000, silently overriding.
      expect(loadConfig({ BOT_TOKEN: 'x', PORT: '0' }).port).toBe(0);
    });

    test('negative PORT falls back to default 3000', () => {
      expect(loadConfig({ BOT_TOKEN: 'x', PORT: '-1' }).port).toBe(3000);
    });
  });
});
