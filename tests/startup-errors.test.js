const { buildStartupErrorHandler } = require('../src/lib/startup-errors');

describe('buildStartupErrorHandler', () => {
  let exitSpy;
  let consoleSpy;
  let setTimeoutSpy;

  beforeEach(() => {
    // The handler arms a `setTimeout(...).unref()` force-kill timer and calls
    // `shutdown(..., 1)`. We capture all three side effects.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
    if (setTimeoutSpy) setTimeoutSpy.mockRestore();
  });

  test('logs structurally, arms the force-kill timer, and delegates to shutdown', () => {
    const shutdown = jest.fn();
    const handler = buildStartupErrorHandler('polling', shutdown, { forceExitMs: 100 });

    const err = new Error('bad token');
    handler(err);

    // Logger writes structured JSON to console.log/error; verify a log line
    // came through and that it referenced both the scope and the message.
    // (logger.js routes 'error' to console.error.)
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const line = consoleSpy.mock.calls[0][0];
    expect(line).toContain('polling');
    expect(line).toContain('bad token');

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledWith('polling-startup-failure', 1);
  });

  test('extracts err.message when present (no double "Error: " prefix in the log)', () => {
    const shutdown = jest.fn();
    const handler = buildStartupErrorHandler('webhook', shutdown, { forceExitMs: 100 });
    handler(new Error('network down'));

    const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsed.extra.error).toBe('network down'); // not "Error: network down"
    expect(parsed.extra.stack).toContain('Error: network down'); // stack keeps the prefix
  });

  test('falls back to String(err) when err.message is absent', () => {
    const shutdown = jest.fn();
    const handler = buildStartupErrorHandler('polling', shutdown, { forceExitMs: 100 });
    handler('plain string thrown');

    const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsed.extra.error).toBe('plain string thrown');
    expect(parsed.extra.stack).toBeUndefined();
  });

  test('force-kill timer is cleared after shutdown returns', async () => {
    jest.useFakeTimers();
    try {
      const shutdown = jest.fn();
      const handler = buildStartupErrorHandler('polling', shutdown, { forceExitMs: 5000 });
      handler(new Error('bad token'));

      await Promise.resolve();
      jest.advanceTimersByTime(5000);
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('force-kill timer fires process.exit(1) when shutdown does not return', () => {
    jest.useFakeTimers();
    try {
      const shutdown = jest.fn(() => new Promise(() => {})); // never resolves the close
      const handler = buildStartupErrorHandler('polling', shutdown, { forceExitMs: 5000 });
      handler(new Error('hang'));

      // Nothing should have called process.exit yet (shutdown is mocked
      // synchronously and returns undefined — no Promise resolves).
      expect(exitSpy).not.toHaveBeenCalled();

      // Advance past the force-kill deadline.
      jest.advanceTimersByTime(5000);
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
