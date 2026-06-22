class ConfigError extends Error {
  constructor(messages) {
    super(messages.join('\n'));
    this.name = 'ConfigError';
    this.messages = messages;
  }
}

function parsePort(value, fallback = 3000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildConfig(env = process.env) {
  const botToken = env.BOT_TOKEN;
  const webhookUrl = env.WEBHOOK_URL || '';
  const webhookSecret = env.WEBHOOK_SECRET || '';
  const messages = [];

  if (!botToken) {
    messages.push('Missing BOT_TOKEN. Copy .env.example to .env and fill in your token.');
  }

  if (webhookUrl && !webhookSecret) {
    messages.push(
      'WEBHOOK_URL is set but WEBHOOK_SECRET is empty. Generate one with `openssl rand -hex 32` and set both env vars.'
    );
  }

  if (messages.length) {
    throw new ConfigError(messages);
  }

  return {
    botToken,
    webhookUrl,
    webhookSecret,
    port: parsePort(env.PORT),
  };
}

module.exports = { ConfigError, buildConfig, parsePort };
