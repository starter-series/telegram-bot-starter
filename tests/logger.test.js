// Exercise the structured logger (src/lib/logger.js). It was only 83% covered
// because the LOG_LEVEL threshold branch and the debug() passthrough were never
// driven. Two behaviors matter and are asserted here:
//   1. LOG_LEVEL filtering — entries below the configured threshold are dropped;
//      entries at/above it are emitted.
//   2. stream routing — 'error' goes to stderr (console.error), everything else
//      to stdout (console.log).
//
// `level` is read from process.env.LOG_LEVEL at module-load time, so each
// scenario sets the env, jest.resetModules(), then re-requires to re-evaluate
// that top-level read.

function loadLogger(logLevel) {
  jest.resetModules();
  const prev = process.env.LOG_LEVEL;
  if (logLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = logLevel;
  try {
    return require('../src/lib/logger');
  } finally {
    if (prev === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = prev;
  }
}

describe('logger — stream routing', () => {
  let logSpy;
  let errSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  test("error() routes to stderr (console.error), not stdout", () => {
    const log = loadLogger('debug'); // threshold low so nothing is filtered
    log.error('ctx', 'boom');
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('debug / info / warn route to stdout (console.log), not stderr', () => {
    const log = loadLogger('debug');
    log.debug('ctx', 'd');
    log.info('ctx', 'i');
    log.warn('ctx', 'w');
    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(errSpy).not.toHaveBeenCalled();
  });

  test('emits a single-line JSON entry with ts/level/ctx/msg and optional extra', () => {
    const log = loadLogger('debug');
    log.info('startup', 'ready', { port: 3000 });
    const line = logSpy.mock.calls[0][0];
    // Must be one parseable JSON line (log aggregators ingest it line-by-line).
    expect(line).not.toContain('\n');
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: 'info', ctx: 'startup', msg: 'ready', extra: { port: 3000 } });
    expect(typeof parsed.ts).toBe('string');
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
  });

  test('omits the extra key entirely when no extra is passed', () => {
    const log = loadLogger('debug');
    log.info('ctx', 'no extra here');
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed).not.toHaveProperty('extra');
  });
});

describe('logger — LOG_LEVEL filtering', () => {
  let logSpy;
  let errSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  function emitted() {
    return logSpy.mock.calls.length + errSpy.mock.calls.length;
  }

  test('LOG_LEVEL=warn drops sub-threshold debug/info but emits warn/error', () => {
    const log = loadLogger('warn');
    log.debug('ctx', 'd'); // below threshold -> dropped
    log.info('ctx', 'i');  // below threshold -> dropped
    expect(emitted()).toBe(0);

    log.warn('ctx', 'w');  // at threshold -> emitted
    log.error('ctx', 'e'); // above threshold -> emitted
    expect(logSpy).toHaveBeenCalledTimes(1); // warn -> stdout
    expect(errSpy).toHaveBeenCalledTimes(1); // error -> stderr
  });

  test('LOG_LEVEL=error drops everything below error', () => {
    const log = loadLogger('error');
    log.debug('ctx', 'd');
    log.info('ctx', 'i');
    log.warn('ctx', 'w');
    expect(emitted()).toBe(0);
    log.error('ctx', 'e');
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  test('default level (LOG_LEVEL unset) is info — debug dropped, info emitted', () => {
    const log = loadLogger(undefined);
    log.debug('ctx', 'should be dropped at default level');
    expect(emitted()).toBe(0);
    log.info('ctx', 'should be emitted at default level');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  test('an unrecognized LOG_LEVEL falls back to the info default', () => {
    const log = loadLogger('verbose'); // not a real level
    log.debug('ctx', 'dropped');
    expect(emitted()).toBe(0);
    log.info('ctx', 'emitted');
    expect(emitted()).toBe(1);
  });

  test('LOG_LEVEL is case-insensitive (WARN == warn)', () => {
    const log = loadLogger('WARN');
    log.info('ctx', 'dropped');
    expect(emitted()).toBe(0);
    log.warn('ctx', 'emitted');
    expect(emitted()).toBe(1);
  });
});
