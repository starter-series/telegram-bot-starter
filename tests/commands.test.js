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
});
