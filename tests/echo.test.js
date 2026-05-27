// Exercise the registered `message:text` handler instead of the module's
// export shape. The 2026-05-21 second-pass audit found this surface had 0%
// function coverage despite being the entire user-facing bot behavior.

const echo = require('../src/handlers/echo');

/**
 * Capture the listener that echo.register installs on `bot.on('message:text', ...)`.
 * Returns an `invoke(ctx)` callable that runs the same code path Telegram
 * traffic would.
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
// "default user 42" from "no user at all" (channel post). Destructuring with
// `from = X` collapses explicit-undefined into the default, hiding the case;
// `'from' in opts` does not.
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
    // safeReply forwards an `options` arg (undefined here) to ctx.reply.
    const [text, options] = ctx.reply.mock.calls[0];
    expect(text).toBe('ping');
    expect(options).toBeUndefined();
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

  test('ignores channel posts (no `from` field)', async () => {
    const listener = loadEchoListener();
    const ctx = makeCtx({ text: 'from a channel', from: undefined });
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
    expect(reply.length).toBe(4096);
  });

  test('rate-limits a single user after 10 messages / minute and does not reply', async () => {
    // Each test gets its own listener so the in-handler limiter is fresh.
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
