require('dotenv').config();

if (!process.env.BOT_TOKEN) {
  console.error('Missing BOT_TOKEN. Copy .env.example to .env and fill in your token.');
  process.exit(1);
}

const webhookUrl = process.env.WEBHOOK_URL || '';
const webhookSecret = process.env.WEBHOOK_SECRET || '';

// In webhook mode without a secret, ANY HTTP client that knows the URL can
// post forged updates and impersonate Telegram. setWebhook + grammy can verify
// the X-Telegram-Bot-Api-Secret-Token header — fail fast at boot if it's missing.
if (webhookUrl && !webhookSecret) {
  console.error(
    'WEBHOOK_URL is set but WEBHOOK_SECRET is empty.',
    'Generate one with `openssl rand -hex 32` and set both env vars.',
  );
  process.exit(1);
}

module.exports = {
  botToken: process.env.BOT_TOKEN,
  webhookUrl,
  webhookSecret,
  port: parseInt(process.env.PORT, 10) || 3000,
};
