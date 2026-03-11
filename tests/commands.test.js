const fs = require('fs');
const path = require('path');

describe('Command files', () => {
  const commandsPath = path.join(__dirname, '..', 'src', 'commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file !== 'index.js' && file.endsWith('.js'));

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
