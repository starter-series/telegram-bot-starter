const { ConfigError, buildConfig, parsePort } = require('../src/lib/config');

// Exercise env validation through the pure builder first. The top-level
// src/config.js wrapper still fail-fasts with process.exit(1), but keeping the
// parsing contract pure makes the bootstrap path testable without a live token.
jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

function loadRuntimeConfig(env) {
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
    const cfg = buildConfig({ BOT_TOKEN: 'test-token-123' });
    expect(cfg.botToken).toBe('test-token-123');
    expect(cfg.webhookUrl).toBe('');
    expect(cfg.webhookSecret).toBe('');
    expect(cfg.port).toBe(3000);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('throws a ConfigError when BOT_TOKEN is missing', () => {
    expect(() => buildConfig({})).toThrow(ConfigError);
  });

  test('throws when WEBHOOK_URL is set but WEBHOOK_SECRET is missing', () => {
    // Without the secret token, anyone who learns the URL can forge updates.
    // config.js refuses to start in that posture.
    expect(() => buildConfig({
      BOT_TOKEN: 'test-token',
      WEBHOOK_URL: 'https://bot.example.com/webhook',
      // WEBHOOK_SECRET omitted
    })).toThrow(/WEBHOOK_SECRET/);
  });

  test('accepts webhook mode when both URL and SECRET are provided', () => {
    const cfg = buildConfig({
      BOT_TOKEN: 'test-token',
      WEBHOOK_URL: 'https://bot.example.com/webhook',
      WEBHOOK_SECRET: 'a'.repeat(64),
    });
    expect(cfg.webhookUrl).toBe('https://bot.example.com/webhook');
    expect(cfg.webhookSecret).toHaveLength(64);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('runtime wrapper exits with code 1 on bad env', () => {
    loadRuntimeConfig({});
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing BOT_TOKEN'));
  });

  describe('PORT parsing', () => {
    test('numeric string is parsed as an integer', () => {
      expect(parsePort('8080')).toBe(8080);
    });

    test('non-numeric string falls back to default 3000', () => {
      expect(parsePort('not-a-number')).toBe(3000);
    });

    test('absent PORT falls back to default 3000', () => {
      expect(parsePort(undefined)).toBe(3000);
    });

    test('PORT=0 is accepted (ephemeral-port request), NOT silently overridden by 3000', () => {
      // Common in test harnesses and some PaaS configurations: PORT=0 asks
      // the OS to assign an ephemeral free port. The previous
      // `parseInt(PORT, 10) || 3000` collapsed 0 → 3000, silently overriding.
      expect(parsePort('0')).toBe(0);
    });

    test('negative PORT falls back to default 3000', () => {
      expect(parsePort('-1')).toBe(3000);
    });
  });
});
