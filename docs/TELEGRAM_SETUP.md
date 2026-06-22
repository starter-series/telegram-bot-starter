# Telegram Bot Setup

Step-by-step guide to create a Telegram bot and configure it for this project.

---

## 1. Create a Bot with BotFather

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a **display name** for your bot (e.g., `My Awesome Bot`)
4. Choose a **username** — must end with `bot` (e.g., `my_awesome_bot`)
5. BotFather will reply with your **bot token** — copy it

> **Important:** Never share your bot token. If it leaks, use `/revoke` in BotFather to generate a new one.

## 2. Configure Your Bot (Optional)

Send these commands to [@BotFather](https://t.me/BotFather) to customize your bot:

| Command | What it does |
|---------|-------------|
| `/setdescription` | Set the bot description (shown on profile) |
| `/setabouttext` | Set the "About" text |
| `/setuserpic` | Set the bot profile picture |
| `/setcommands` | Set the command menu (but this starter auto-registers them) |
| `/setprivacy` | Toggle group privacy mode (disable to read all group messages) |

## 3. Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your bot token:
   ```bash
   BOT_TOKEN=<your-bot-token-from-botfather>
   ```

## 4. Choose: Polling vs Webhook

This starter supports two modes for receiving updates from Telegram:

| Mode | How it works | Best for |
|------|-------------|----------|
| **Long polling** (default) | Bot asks Telegram for updates in a loop | Development, simple deployments |
| **Webhook** | Telegram pushes updates to your server | Production, serverless, high traffic |

### Using Long Polling (Default)

No additional configuration needed. Just start the bot:

```bash
npm run dev
```

### Using Webhook Mode

Set these environment variables in `.env`:

```bash
BOT_TOKEN=<your-bot-token-from-botfather>
WEBHOOK_URL=https://your-domain.com/webhook
WEBHOOK_SECRET=<random-hex-secret>
PORT=3000
```

Requirements for webhooks:
- Your server must be reachable from the internet
- HTTPS is required (Telegram will not send updates to HTTP URLs)
- The port must be one of: 443, 80, 88, or 8443
- `WEBHOOK_SECRET` is required so grammY can verify Telegram's secret-token header

Generate a webhook secret:

```bash
openssl rand -hex 32
```

> **Tip:** For local development with webhooks, use [ngrok](https://ngrok.com/):
> ```bash
> ngrok http 3000
> ```
> Then set `WEBHOOK_URL` to the ngrok HTTPS URL.

## 5. Start the Bot

```bash
npm run dev
```

Open Telegram, find your bot by its username, and send `/start`. You should see a greeting message.

## 6. Add GitHub Secrets (for CD)

If you plan to deploy with the CD pipeline, the bot token needs to be configured on your deployment platform.

See [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md) or [FLY_DEPLOY.md](FLY_DEPLOY.md) for deployment-specific setup.

---

## Bot API Limits

Useful limits to keep in mind:

| Limit | Value |
|-------|-------|
| Messages per second (to same chat) | 1 |
| Messages per second (total) | 30 |
| Bulk messages per second | 20 per minute to different chats |
| Message text length | 4096 characters |
| Caption length | 1024 characters |
| File upload size | 50 MB |
| File download size | 20 MB |
| Inline results | 50 per query |

---

## Troubleshooting

### "Unauthorized" or "Not Found" error on startup

- Make sure your bot token is correct — copy it again from BotFather
- If you revoked the token, get a new one with `/token` in BotFather
- Check there are no extra spaces or quotes around the token in `.env`

### Bot starts but does not respond

- Make sure you are messaging the correct bot (check the username)
- Try sending `/start` — the default commands are `/start` and `/help`
- Check the console for error messages
- If using webhook mode, verify your URL is reachable and uses HTTPS

### "Conflict: terminated by other getUpdates request"

- Another instance of your bot is running (maybe a local dev server and a deployed version)
- Stop the other instance or switch to webhook mode for production
- Only one polling connection is allowed per bot token

### Webhook not receiving updates

- Verify the URL is HTTPS (HTTP will not work)
- Check that the port is one of: 443, 80, 88, or 8443
- Test the URL manually: `curl https://your-domain.com/webhook`
- Check webhook status:
  ```bash
  curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
  ```
- Delete and re-set the webhook if it is stuck:
  ```bash
  curl https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook
  ```

### Commands not showing in the menu

- grammY auto-registers commands via `bot.api.setMyCommands()` if configured
- You can also set them manually via BotFather: `/setcommands`
- Menu updates may take a few seconds to appear in the Telegram app
