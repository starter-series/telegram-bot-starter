require('dotenv').config();

if (!process.env.BOT_TOKEN) {
  console.error('Missing BOT_TOKEN. Copy .env.example to .env and fill in your token.');
  process.exit(1);
}

module.exports = {
  botToken: process.env.BOT_TOKEN,
  webhookUrl: process.env.WEBHOOK_URL || '',
  port: parseInt(process.env.PORT, 10) || 3000,
};
