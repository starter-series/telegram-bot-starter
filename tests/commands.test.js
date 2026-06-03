const fs = require('fs');
const path = require('path');

const commandsPath = path.join(__dirname, '..', 'src', 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file !== 'index.js' && file.endsWith('.js'));

describe('Command files', () => {
  test('at least one command exists', () => {
    expect(commandFiles.length).toBeGreaterThan(0);
  });

  test.each(commandFiles)('%s exports name and execute', (file) => {
    const command = require(path.join(commandsPath, file));
    expect(command).toHaveProperty('name');
    expect(command).toHaveProperty('execute');
    expect(typeof command.execute).toBe('function');
    expect(command.name).toBeTruthy();
    expect(command.description).toBeTruthy();
  });
});

describe('Command loader shape guard', () => {
  // The loader require()s every .js in src/commands. Audit finding: a stray
  // helper file with no { name, execute } shape would register
  // bot.command(undefined, undefined) (garbage) or crash boot. Drop a
  // non-conforming module on disk, run the loader, and assert it is skipped
  // with a warning rather than registered or fatal.
  const strayPath = path.join(commandsPath, '__stray_helper.js');

  afterEach(() => {
    if (fs.existsSync(strayPath)) fs.unlinkSync(strayPath);
    delete require.cache[require.resolve(strayPath)];
  });

  test('skips a non-conforming command module instead of registering it', () => {
    fs.writeFileSync(strayPath, 'module.exports = { helper: () => 42 };\n');

    const { registerCommands, commands } = require(path.join(commandsPath, 'index.js'));
    commands.length = 0;

    const fakeBot = { command: jest.fn() };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Must not throw on boot.
      expect(() => registerCommands(fakeBot)).not.toThrow();

      // The stray module must not be registered with the bot...
      const registeredNames = fakeBot.command.mock.calls.map(([name]) => name);
      expect(registeredNames).not.toContain(undefined);
      // ...and the real commands must still be wired up.
      expect(registeredNames).toContain('start');

      // The shared commands array must not contain the stray module.
      expect(commands.every((c) => typeof c.name === 'string' && c.name.length > 0)).toBe(true);
      expect(commands.some((c) => c.helper)).toBe(false);

      // It must warn about the skipped file.
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('__stray_helper.js'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('/start command', () => {
  const start = require(path.join(commandsPath, 'start.js'));

  test('replies with a greeting that mentions /help', async () => {
    const ctx = { reply: jest.fn().mockResolvedValue(undefined) };

    await start.execute(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text] = ctx.reply.mock.calls[0];
    expect(text).toMatch(/help/i);
  });

  test('swallows reply errors so the bot process keeps running', async () => {
    const ctx = { reply: jest.fn().mockRejectedValue(new Error('boom')) };
    await expect(start.execute(ctx)).resolves.toBeUndefined();
  });
});

describe('/help command', () => {
  const help = require(path.join(commandsPath, 'help.js'));

  test('lists every registered command in the reply', async () => {
    // /help reads from the shared `commands` array populated by
    // registerCommands. Exercise the full loader against a fake bot so the
    // reply reflects the real command list instead of a mock.
    const { registerCommands, commands } = require(path.join(commandsPath, 'index.js'));
    commands.length = 0;
    const fakeBot = { command: jest.fn() };
    registerCommands(fakeBot);

    const ctx = { reply: jest.fn().mockResolvedValue(undefined) };
    await help.execute(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text] = ctx.reply.mock.calls[0];
    for (const cmd of commands) {
      expect(text).toContain(`/${cmd.name}`);
      expect(text).toContain(cmd.description);
    }
  });
});

describe('Handler files', () => {
  const handlersPath = path.join(__dirname, '..', 'src', 'handlers');
  const handlerFiles = fs
    .readdirSync(handlersPath)
    .filter((file) => file !== 'index.js' && file.endsWith('.js'));

  test('at least one handler exists', () => {
    expect(handlerFiles.length).toBeGreaterThan(0);
  });

  test.each(handlerFiles)('%s exports name and register', (file) => {
    const handler = require(path.join(handlersPath, file));
    expect(handler).toHaveProperty('name');
    expect(handler).toHaveProperty('register');
    expect(typeof handler.register).toBe('function');
  });

  test('registerHandlers invokes each handler module\'s register exactly once', () => {
    // The 2026-05-21 second-pass audit found src/handlers/index.js had 0%
    // coverage despite being the loader that wires every handler into the
    // bot at startup.
    //
    // The earlier version of this test asserted only that the fake bot's
    // `on` was called at least N times. That is satisfied even when one
    // handler defensively registers two listeners while another's
    // `register()` is empty — the broken handler hides behind the count.
    // Spy on each module's `register` so a no-op handler fails loudly.
    const handlerModules = handlerFiles.map((file) => require(path.join(handlersPath, file)));
    const spies = handlerModules.map((m) => jest.spyOn(m, 'register'));

    try {
      const { registerHandlers } = require(path.join(handlersPath, 'index.js'));
      const fakeBot = { on: jest.fn() };
      registerHandlers(fakeBot);

      for (const spy of spies) {
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(fakeBot);
      }
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  test('skips a non-conforming handler module instead of crashing boot', () => {
    // Audit finding: the handler loader called handler.register(bot)
    // unconditionally, so a stray file without a register() function crashed
    // boot with "handler.register is not a function". Drop one on disk and
    // assert the loader skips it with a warning.
    const strayPath = path.join(handlersPath, '__stray_helper.js');
    fs.writeFileSync(strayPath, 'module.exports = { name: "stray" };\n');

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { registerHandlers } = require(path.join(handlersPath, 'index.js'));
      const fakeBot = { on: jest.fn() };

      // Must not throw on boot despite the missing register().
      expect(() => registerHandlers(fakeBot)).not.toThrow();
      // The real handler must still be wired up (echo registers message:text).
      expect(fakeBot.on).toHaveBeenCalled();
      // It must warn about the skipped file.
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('__stray_helper.js'));
    } finally {
      warn.mockRestore();
      if (fs.existsSync(strayPath)) fs.unlinkSync(strayPath);
      delete require.cache[require.resolve(strayPath)];
    }
  });
});
