# Telegram Bot Setup

## 1. Create a Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a display name (e.g. "My Bot")
4. Choose a username (must end with `bot`, e.g. `my_awesome_bot`)
5. Copy the **bot token** — you'll need it next

## 2. Set Environment Variable

```bash
cp .env.example .env
```

Edit `.env` and paste your token:

```
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
```

## 3. Test Locally

```bash
npm install
npm run dev
```

Open Telegram, find your bot by username, and send `/start`.

## 4. Set Bot Commands (optional)

Send this to @BotFather:

```
/setcommands
```

Then select your bot and send:

```
start - Start the bot
help - List available commands
```

This makes commands appear in Telegram's command menu.

## 5. Webhook vs Long Polling

**Long polling (default):** Bot pulls updates from Telegram. Simple, works everywhere.

**Webhook:** Telegram pushes updates to your server. More efficient for production.

To use webhook mode, set in `.env`:

```
WEBHOOK_URL=https://your-domain.com
PORT=3000
```

> **Note:** Webhook requires HTTPS. Most deployment platforms (Railway, Fly.io) provide this automatically.
