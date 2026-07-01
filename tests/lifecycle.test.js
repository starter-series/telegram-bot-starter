// Drives the lifecycle wiring extracted from src/index.js (src/lib/lifecycle.js).
// The entry point was 0% covered because it could only be exercised by booting
// grammY against the live Telegram API. These tests hit the branching behavior
// directly through injected seams: transport selection, the load-bearing
// shutdown ORDER, the webhook secret_token, the 5s force-kill, and the
// deliberate "unhandledRejection does not shut down" decision.

const { setImmediate: nodeSetImmediate } = require('node:timers');
const {
  selectTransport,
  buildShutdown,
  buildProcessGuards,
  buildWebhookTransport,
  buildPollingTransport,
} = require('../src/lib/lifecycle');

function flushImmediate() {
  const schedule =
    typeof globalThis.setImmediate === 'function'
      ? globalThis.setImmediate
      : nodeSetImmediate;
  return new Promise((resolve) => schedule(resolve));
}

describe('selectTransport', () => {
  test('picks webhook when webhookUrl is a non-empty string', () => {
    expect(selectTransport({ webhookUrl: 'https://bot.example.com/hook' })).toBe('webhook');
  });

  test('falls back to polling for empty string / unset', () => {
    expect(selectTransport({ webhookUrl: '' })).toBe('polling');
    expect(selectTransport({})).toBe('polling');
  });
});

describe('buildShutdown', () => {
  test('closes health → webhook → bot.stop in that order, then exits', async () => {
    const calls = [];
    const healthServer = { stop: jest.fn(() => { calls.push('health'); return Promise.resolve(); }) };
    const webhookServer = { close: jest.fn((cb) => { calls.push('webhook'); cb(); }) };
    const bot = { stop: jest.fn(() => { calls.push('bot'); return Promise.resolve(); }) };
    const exit = jest.fn(() => { calls.push('exit'); });

    const shutdown = buildShutdown({
      getHealthServer: () => healthServer,
      getWebhookServer: () => webhookServer,
      bot,
      exit,
    });

    await shutdown('SIGTERM', 0);

    // The exact sequence is the contract: probe down first, stop inbound
    // updates, then drain the bot, then exit. Reordering would regress this.
    expect(calls).toEqual(['health', 'webhook', 'bot', 'exit']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test('is idempotent — a second signal does not re-run teardown or double-exit', async () => {
    const bot = { stop: jest.fn().mockResolvedValue(undefined) };
    const exit = jest.fn();
    const shutdown = buildShutdown({
      getHealthServer: () => undefined,
      getWebhookServer: () => undefined,
      bot,
      exit,
    });

    await Promise.all([shutdown('SIGINT'), shutdown('SIGTERM')]);
    await shutdown('SIGTERM');

    expect(bot.stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  test('forwards a non-zero exit code (uncaughtException path)', async () => {
    const exit = jest.fn();
    const shutdown = buildShutdown({
      getHealthServer: () => undefined,
      getWebhookServer: () => undefined,
      bot: { stop: jest.fn().mockResolvedValue(undefined) },
      exit,
    });
    await shutdown('uncaughtException', 1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('an error closing the health server still tears down webhook + bot and exits', async () => {
    const calls = [];
    const healthServer = { stop: jest.fn(() => Promise.reject(new Error('close failed'))) };
    const webhookServer = { close: jest.fn((cb) => { calls.push('webhook'); cb(); }) };
    const bot = { stop: jest.fn(() => { calls.push('bot'); return Promise.resolve(); }) };
    const exit = jest.fn(() => { calls.push('exit'); });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const shutdown = buildShutdown({
        getHealthServer: () => healthServer,
        getWebhookServer: () => webhookServer,
        bot,
        exit,
      });
      await shutdown('SIGTERM', 0);

      // One step throwing must not strand the rest — otherwise a flaky server
      // close would leave the bot draining forever and the process never exit.
      expect(calls).toEqual(['webhook', 'bot', 'exit']);
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error closing health server')
      );
    } finally {
      errSpy.mockRestore();
    }
  });

  test('a webhook-close error and a bot.stop error are each logged but do not block exit', async () => {
    const calls = [];
    const healthServer = { stop: jest.fn(() => { calls.push('health'); return Promise.resolve(); }) };
    const webhookServer = { close: jest.fn(() => { throw new Error('close threw'); }) };
    const bot = { stop: jest.fn(() => Promise.reject(new Error('stop rejected'))) };
    const exit = jest.fn(() => { calls.push('exit'); });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const shutdown = buildShutdown({
        getHealthServer: () => healthServer,
        getWebhookServer: () => webhookServer,
        bot,
        exit,
      });
      await shutdown('SIGTERM', 0);

      expect(calls).toEqual(['health', 'exit']); // both error steps swallowed
      const logged = errSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(logged).toContain('Error closing webhook server');
      expect(logged).toContain('Error stopping bot');
    } finally {
      errSpy.mockRestore();
    }
  });

  test('defaults exit to process.exit when no exit seam is supplied', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    try {
      const shutdown = buildShutdown({
        getHealthServer: () => undefined,
        getWebhookServer: () => undefined,
        bot: { stop: jest.fn().mockResolvedValue(undefined) },
      });
      await shutdown('SIGTERM', 0);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
    }
  });

  test('reads servers lazily — a server assigned after build is still closed', async () => {
    // Mirrors index.js: signal handlers (and thus buildShutdown) are wired
    // before `healthServer`/`webhookServer` are assigned by the transport.
    let healthServer;
    const closed = [];
    const exit = jest.fn();
    const shutdown = buildShutdown({
      getHealthServer: () => healthServer,
      getWebhookServer: () => undefined,
      bot: { stop: jest.fn().mockResolvedValue(undefined) },
      exit,
    });

    // Assigned AFTER buildShutdown returned (as the real entry point does).
    healthServer = { stop: jest.fn(() => { closed.push('health'); return Promise.resolve(); }) };

    await shutdown('SIGTERM');
    expect(closed).toEqual(['health']);
  });
});

describe('buildProcessGuards — uncaughtException', () => {
  function fakeProc() {
    const handlers = {};
    return {
      on: jest.fn((event, fn) => { handlers[event] = fn; }),
      exit: jest.fn(),
      handlers,
    };
  }

  test('logs, arms a 5s force-kill timer, and starts shutdown(…, 1)', () => {
    jest.useFakeTimers();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const proc = fakeProc();
      const shutdown = jest.fn();
      buildProcessGuards({ shutdown, proc, forceExitMs: 5000 });

      proc.handlers.uncaughtException(new Error('boom'));

      expect(shutdown).toHaveBeenCalledWith('uncaughtException', 1);
      // Force-kill must NOT have fired before the deadline...
      expect(proc.exit).not.toHaveBeenCalled();
      jest.advanceTimersByTime(4999);
      expect(proc.exit).not.toHaveBeenCalled();
      // ...and MUST fire at 5s so a hung bot.stop() can't keep the container up.
      jest.advanceTimersByTime(1);
      expect(proc.exit).toHaveBeenCalledWith(1);
    } finally {
      errSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('force-kill timer is unref\'d so it never blocks a clean exit', () => {
    jest.useFakeTimers();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unref = jest.fn();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockReturnValue({ unref });
    try {
      const proc = fakeProc();
      buildProcessGuards({ shutdown: jest.fn(), proc, forceExitMs: 5000 });
      proc.handlers.uncaughtException(new Error('boom'));
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(unref).toHaveBeenCalledTimes(1);
    } finally {
      setTimeoutSpy.mockRestore();
      errSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('buildProcessGuards — unhandledRejection', () => {
  function fakeProc() {
    const handlers = {};
    return {
      on: jest.fn((event, fn) => { handlers[event] = fn; }),
      exit: jest.fn(),
      handlers,
    };
  }

  test('logs but does NOT shut down or exit (recoverable-by-default decision)', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const proc = fakeProc();
      const shutdown = jest.fn();
      const { onUnhandledRejection } = buildProcessGuards({ shutdown, proc });

      proc.handlers.unhandledRejection(new Error('stray rejection'));

      // The whole point: a stray rejected promise must not take the worker down.
      expect(shutdown).not.toHaveBeenCalled();
      expect(proc.exit).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unhandledRejection'));
      // Decision is an explicit, asserted contract — not an accident of code shape.
      expect(onUnhandledRejection.shutsDown).toBe(false);
    } finally {
      errSpy.mockRestore();
    }
  });

  test('registers exactly the two guards on the process', () => {
    const proc = fakeProc();
    buildProcessGuards({ shutdown: jest.fn(), proc });
    const events = proc.on.mock.calls.map(([e]) => e).sort();
    expect(events).toEqual(['uncaughtException', 'unhandledRejection']);
  });
});

describe('buildWebhookTransport', () => {
  function fakeBot() {
    return {
      api: { setWebhook: jest.fn().mockResolvedValue(undefined) },
    };
  }
  function fakeHttp() {
    const server = { on: jest.fn(), listen: jest.fn((port, cb) => cb && cb()), close: jest.fn() };
    return { server, lib: { createServer: jest.fn(() => server) } };
  }

  test('enforces the secret token on BOTH the callback verifier and setWebhook', async () => {
    const config = {
      webhookUrl: 'https://bot.example.com/hook',
      webhookSecret: 's3cr3t-token-value',
      port: 8443,
    };
    const bot = fakeBot();
    const { server, lib } = fakeHttp();
    const webhookCallbackFn = jest.fn(() => (req, res) => {});

    buildWebhookTransport({
      config,
      bot,
      shutdown: jest.fn(),
      httpLib: lib,
      webhookCallbackFn,
    });

    // grammy verifies the X-Telegram-Bot-Api-Secret-Token header using this:
    expect(webhookCallbackFn).toHaveBeenCalledWith(bot, 'http', {
      secretToken: 's3cr3t-token-value',
    });
    // ...and Telegram is told to send that same token. A drift between the two
    // (or a missing token) is the forged-update vulnerability this guards.
    expect(bot.api.setWebhook).toHaveBeenCalledWith(
      'https://bot.example.com/hook',
      { secret_token: 's3cr3t-token-value' }
    );
    // listens on the configured port and returns the server for shutdown.
    expect(server.listen).toHaveBeenCalledWith(8443, expect.any(Function));
    await Promise.resolve();
  });

  test('logs (does not throw) when the webhook server emits an error event', () => {
    const config = { webhookUrl: 'https://x/hook', webhookSecret: 'tok', port: 80 };
    const handlers = {};
    const server = {
      on: jest.fn((event, fn) => { handlers[event] = fn; }),
      listen: jest.fn((port, cb) => cb && cb()),
      close: jest.fn(),
    };
    const lib = { createServer: jest.fn(() => server) };
    const bot = { api: { setWebhook: jest.fn().mockResolvedValue(undefined) } };
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      buildWebhookTransport({
        config,
        bot,
        shutdown: jest.fn(),
        httpLib: lib,
        webhookCallbackFn: jest.fn(() => () => {}),
      });
      expect(typeof handlers.error).toBe('function');
      expect(() => handlers.error(new Error('EADDRINUSE'))).not.toThrow();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Server error'));
    } finally {
      errSpy.mockRestore();
    }
  });

  test('a setWebhook failure is routed through shutdown (not a leaked rejection)', async () => {
    const config = { webhookUrl: 'https://x/hook', webhookSecret: 'tok', port: 80 };
    const bot = { api: { setWebhook: jest.fn().mockRejectedValue(new Error('401')) } };
    const { lib } = fakeHttp();
    const shutdown = jest.fn();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    try {
      buildWebhookTransport({
        config,
        bot,
        shutdown,
        httpLib: lib,
        webhookCallbackFn: jest.fn(() => () => {}),
      });
      // Let the rejected setWebhook promise settle.
      await flushImmediate();
      expect(shutdown).toHaveBeenCalledWith('webhook-startup-failure', 1);
    } finally {
      errSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});

describe('buildPollingTransport', () => {
  test('starts the health server and begins long-polling, returning the health server', () => {
    const healthServer = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn() };
    const createHealthServerFn = jest.fn(() => healthServer);
    const bot = { start: jest.fn().mockResolvedValue(undefined) };

    const returned = buildPollingTransport({
      bot,
      shutdown: jest.fn(),
      createHealthServerFn,
    });

    expect(createHealthServerFn).toHaveBeenCalledWith(bot, { mode: 'polling' });
    expect(healthServer.start).toHaveBeenCalledTimes(1);
    expect(bot.start).toHaveBeenCalledTimes(1);
    // Returned so the entry point can hand it to buildShutdown.
    expect(returned).toBe(healthServer);

    // The onStart callback passed to bot.start logs the running line.
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const onStart = bot.start.mock.calls[0][0].onStart;
      onStart();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('long polling'));
    } finally {
      logSpy.mockRestore();
    }
  });

  test('logs (does not crash) when the health server fails to start', async () => {
    const healthServer = { start: jest.fn().mockRejectedValue(new Error('EADDRINUSE')), stop: jest.fn() };
    const bot = { start: jest.fn().mockResolvedValue(undefined) };
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      buildPollingTransport({ bot, shutdown: jest.fn(), createHealthServerFn: () => healthServer });
      await flushImmediate();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to start health server'));
    } finally {
      errSpy.mockRestore();
    }
  });

  test('a bot.start failure is routed through shutdown', async () => {
    const healthServer = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn() };
    const bot = { start: jest.fn().mockRejectedValue(new Error('bad token')) };
    const shutdown = jest.fn();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    try {
      buildPollingTransport({ bot, shutdown, createHealthServerFn: () => healthServer });
      await flushImmediate();
      expect(shutdown).toHaveBeenCalledWith('polling-startup-failure', 1);
    } finally {
      errSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
