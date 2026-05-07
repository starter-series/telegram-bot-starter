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
