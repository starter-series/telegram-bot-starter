// Exercise the registered `message:text` handler instead of the module's
// export shape. The 2026-05-21 second-pass audit found this surface had 0%
// function coverage despite being the entire user-facing bot behavior.
//
// The echo handler holds a module-level `limiter` (see src/handlers/echo.js).
// To give every test a fresh limiter we `jest.resetModules()` in `beforeEach`
// and re-`require` echo.js so the closed-over `createRateLimiter` instance is
// rebuilt. Without this each test would inherit count state from prior tests
// in this file — today the tests use disjoint user ids by accident, but a
// future contributor reusing an id would hit a confusing rate-limit failure
// that the original comment ("each test gets its own listener so the
// in-handler limiter is fresh") flatly lied about.

let echo;

beforeEach(() => {
  jest.resetModules();
  echo = require('../src/handlers/echo');
});

/**
 * Capture the listener that echo.register installs on `bot.on('message:text', ...)`.
 * Returns the listener callable directly so tests run the same code path
 * Telegram traffic would.
 */
function loadEchoListener() {
  let listener;
  const fakeBot = {
    on: jest.fn((event, cb) => {
      if (event === 'message:text') listener = cb;
    }),
  };
  echo.register(fakeBot);
  expect(fakeBot.on).toHaveBeenCalledWith('message:text', expect.any(Function));
  if (!listener) throw new Error('echo handler did not register message:text');
  return listener;
}

// `from` is built from the caller's options object so we can distinguish
// "default user 42" from "no user at all" (anonymous group admin). Destructuring
// with `from = X` collapses explicit-undefined into the default, hiding the
// case; `'from' in opts` does not.
function makeCtx(opts = {}) {
  const text = opts.text ?? 'hello';
  const isCommand = opts.isCommand ?? false;
  const from = 'from' in opts ? opts.from : { id: 42 };
  return {
    message: { text },
    from,
    // `entities(kind)` is grammy's helper for typed message entities; the
    // handler skips text whose first entity is a `bot_command` at offset 0.
    entities: () => (isCommand ? [{ offset: 0, length: text.length, type: 'bot_command' }] : []),
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

describe('echo handler', () => {
  test('echoes a plain text message back', async () => {
    const listener = loadEchoListener();
    const ctx = makeCtx({ text: 'ping', from: { id: 1 } });
    await listener(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    // Only assert the echoed text — `options` is forwarded by safeReply and
    // would change shape if a future commit adds defensive defaults; that's
    // not a contract this handler owns.
    const [text] = ctx.reply.mock.calls[0];
    expect(text).toBe('ping');
  });

  test('skips empty / whitespace-only text without replying', async () => {
    const listener = loadEchoListener();
    for (const text of ['', '   ', '\n\t']) {
      const ctx = makeCtx({ text, from: { id: 2 } });
      await listener(ctx);
      expect(ctx.reply).not.toHaveBeenCalled();
    }
  });

  test('skips messages that begin with a /command so /start is not double-echoed', async () => {
    const listener = loadEchoListener();
    const ctx = makeCtx({ text: '/start', from: { id: 3 }, isCommand: true });
    await listener(ctx);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  // grammY's `message:text` handler CAN fire with `ctx.from === undefined`
  // when an anonymous group admin posts as the chat itself (their identity
  // is in `ctx.senderChat`, not `ctx.from`). The handler must not throw or
  // burn a rate-limit slot for an id that isn't there.
  test('ignores messages with no `from` field (anonymous-admin shape)', async () => {
    const listener = loadEchoListener();
    const ctx = makeCtx({ text: 'from an anonymous admin', from: undefined });
    await listener(ctx);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  test('truncates messages longer than 4096 chars to the Telegram limit', async () => {
    const listener = loadEchoListener();
    const long = 'a'.repeat(5000);
    const ctx = makeCtx({ text: long, from: { id: 4 } });
    await listener(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [reply] = ctx.reply.mock.calls[0];
    // Verify content too, not just length — otherwise a refactor that
    // truncates to 4093 + appends '...' (also 4096 chars) would pass while
    // corrupting the last three chars of legitimate output.
    expect(reply).toBe('a'.repeat(4096));
  });

  test('rate-limits a single user after 10 messages / minute and does not reply', async () => {
    // `beforeEach` reset modules so the in-handler limiter is genuinely fresh
    // for this test — see the file-level comment.
    const listener = loadEchoListener();
    const from = { id: 5 };
    for (let i = 0; i < 10; i += 1) {
      const ctx = makeCtx({ text: `msg ${i}`, from });
      await listener(ctx);
      expect(ctx.reply).toHaveBeenCalledTimes(1);
    }
    // 11th message must be dropped silently — no reply (replying would burn
    // the user's outbound budget).
    const eleventh = makeCtx({ text: 'over the cap', from });
    await listener(eleventh);
    expect(eleventh.reply).not.toHaveBeenCalled();
  });
});
