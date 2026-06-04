const { GrammyError, HttpError } = require('grammy');
const { safeReply } = require('../src/lib/safe-reply');

function fakeCtx(replyImpl) {
  return { reply: jest.fn().mockImplementation(replyImpl) };
}

function makeGrammyError(code, params = {}) {
  // grammy's GrammyError requires (description, payload, method)-shaped args;
  // simulate the fields the helper inspects.
  const err = Object.create(GrammyError.prototype);
  err.error_code = code;
  err.description = `simulated ${code}`;
  err.parameters = params;
  return err;
}

describe('safeReply', () => {
  test('returns the result on a clean reply', async () => {
    const ctx = fakeCtx(() => Promise.resolve('ok'));
    const r = await safeReply(ctx, 'hi');
    expect(r).toBe('ok');
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  test('on 429, sleeps the suggested seconds and retries once', async () => {
    let attempt = 0;
    const ctx = fakeCtx(() => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(makeGrammyError(429, { retry_after: 0 }));
      return Promise.resolve('retried');
    });
    const r = await safeReply(ctx, 'hi');
    expect(r).toBe('retried');
    expect(ctx.reply).toHaveBeenCalledTimes(2);
  });

  test('honors a POSITIVE server retry_after as the exact retry delay (fake timers)', async () => {
    // Regression guard for the `|| 1` coercion. Drive the setTimeout with fake
    // timers and prove the retry waits the server-suggested 5s — not before,
    // and exactly at it. Asserting the delay value (not just "retry happened")
    // is what makes a future `* 1000` / off-by-one regression fail here.
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      let attempt = 0;
      const ctx = fakeCtx(() => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(makeGrammyError(429, { retry_after: 5 }));
        return Promise.resolve('retried');
      });

      const promise = safeReply(ctx, 'hi');
      // Let the rejected first attempt settle and the setTimeout get armed.
      await Promise.resolve();
      await Promise.resolve();

      // Before the suggested delay the retry must NOT have been issued.
      jest.advanceTimersByTime(4999);
      expect(ctx.reply).toHaveBeenCalledTimes(1);

      // At exactly 5s the retry fires.
      jest.advanceTimersByTime(1);
      const r = await promise;
      expect(r).toBe('retried');
      expect(ctx.reply).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('honors retry_after:0 as an IMMEDIATE retry — does NOT stall a full second', async () => {
    // The bug: `Number(0) || 1` coerces a valid "retry immediately" 0 into a
    // needless 1000ms sleep. With fake timers, advancing by 0 must already let
    // the retry resolve; if the code still waited 1s this would hang at
    // advanceTimersByTime(0) and the retry would not have fired.
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      let attempt = 0;
      const ctx = fakeCtx(() => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(makeGrammyError(429, { retry_after: 0 }));
        return Promise.resolve('retried');
      });

      const promise = safeReply(ctx, 'hi');
      await Promise.resolve();
      await Promise.resolve();

      // A 0ms timer is due immediately — no 1s stall.
      jest.advanceTimersByTime(0);
      const r = await promise;
      expect(r).toBe('retried');
      expect(ctx.reply).toHaveBeenCalledTimes(2);

      // Belt-and-suspenders: the only timer armed had a 0ms delay, proving the
      // `|| 1` → 1000ms path was not taken. (jest tracks pending timer count.)
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('falls back to 1s when retry_after is missing / malformed (negative, NaN)', async () => {
    // The fallback must still exist for malformed payloads — only valid finite
    // non-negative values are honored verbatim.
    for (const params of [{}, { retry_after: -3 }, { retry_after: 'soon' }]) {
      jest.useFakeTimers();
      try {
        let attempt = 0;
        const ctx = fakeCtx(() => {
          attempt += 1;
          if (attempt === 1) return Promise.reject(makeGrammyError(429, params));
          return Promise.resolve('retried');
        });
        const promise = safeReply(ctx, 'hi');
        await Promise.resolve();
        await Promise.resolve();

        // Not yet at 1s -> no retry.
        jest.advanceTimersByTime(999);
        expect(ctx.reply).toHaveBeenCalledTimes(1);
        // At 1s the fallback fires.
        jest.advanceTimersByTime(1);
        await promise;
        expect(ctx.reply).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    }
  });

  test('on 429 with retry-also-fails, returns null (no rethrow)', async () => {
    const ctx = fakeCtx(() => Promise.reject(makeGrammyError(429, { retry_after: 0 })));
    const r = await safeReply(ctx, 'hi');
    expect(r).toBeNull();
    expect(ctx.reply).toHaveBeenCalledTimes(2);
  });

  test('non-429 GrammyError logs and drops', async () => {
    const ctx = fakeCtx(() => Promise.reject(makeGrammyError(403)));
    const r = await safeReply(ctx, 'hi');
    expect(r).toBeNull();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  test('HttpError is swallowed', async () => {
    const err = Object.create(HttpError.prototype);
    err.message = 'network down';
    const ctx = fakeCtx(() => Promise.reject(err));
    const r = await safeReply(ctx, 'hi');
    expect(r).toBeNull();
  });

  test('unknown error class is logged and dropped (was rethrowing — bug)', async () => {
    const ctx = fakeCtx(() => Promise.reject(new Error('mystery')));
    const r = await safeReply(ctx, 'hi');
    expect(r).toBeNull();
  });
});
