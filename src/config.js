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

// PORT=0 is a valid "OS-assign an ephemeral port" request used by tests and
// some PaaS environments, so we cannot use `|| 3000` (that would silently
// override 0 → 3000). Accept any non-negative integer, fall back otherwise.
const parsedPort = Number.parseInt(process.env.PORT, 10);
const port = Number.isInteger(parsedPort) && parsedPort >= 0 ? parsedPort : 3000;

module.exports = {
  botToken: process.env.BOT_TOKEN,
  webhookUrl,
  webhookSecret,
  port,
};
