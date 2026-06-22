# Deployment Guide

Step-by-step guide to deploy your Telegram bot to Railway or Fly.io.

---

## Option A: Deploy to Railway

### 1. Create a Railway Account

1. Go to [railway.app](https://railway.app/) and sign up
2. Connect your GitHub account

### 2. Create a New Project

1. Click **New Project** > **Deploy from GitHub repo**
2. Select your bot repository
3. Railway will auto-detect the `Dockerfile` and start building

### 3. Set Environment Variables

In the Railway dashboard, go to your service > **Variables** and add:

| Variable | Value | Required |
|----------|-------|----------|
| `BOT_TOKEN` | Your bot token from BotFather | Yes |
| `WEBHOOK_URL` | Your Railway public URL + `/webhook` | No (for webhook mode) |
| `WEBHOOK_SECRET` | Random secret from `openssl rand -hex 32` | Yes when `WEBHOOK_URL` is set |
| `PORT` | Railway assigns automatically | No |

> **Polling vs Webhook on Railway:** Long polling works out of the box. For webhook mode, use the Railway-provided URL (found in service **Settings** > **Networking** > **Public Networking**).

### 4. Get Railway API Credentials

1. Go to [railway.app/account/tokens](https://railway.app/account/tokens)
2. Click **Create Token**
3. Name it `github-deploy` and copy the token

To get your Service ID:
1. Open your project in Railway dashboard
2. Click on your service
3. Go to **Settings**
4. Copy the **Service ID** (or find it in the URL)

### 5. Add GitHub Secrets

Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:

| Secret | Value | Where to find it |
|--------|-------|-------------------|
| `RAILWAY_TOKEN` | API token | Railway > Account > Tokens |
| `RAILWAY_SERVICE_ID` | Service ID | Railway > Service > Settings |

### 6. Deploy

1. Bump version: `npm run version:patch`
2. Commit and push
3. Go to **Actions** tab > **Deploy to Railway** > **Run workflow**

The workflow runs CI first, then deploys to Railway and creates a GitHub Release.

---

## Option B: Deploy to Fly.io

### 1. Create a Fly.io Account

1. Go to [fly.io](https://fly.io/) and sign up
2. Install the Fly CLI:
   ```bash
   # macOS
   brew install flyctl

   # Linux
   curl -L https://fly.io/install.sh | sh

   # Windows
   powershell -Command "irm https://fly.io/install.ps1 | iex"
   ```
3. Log in:
   ```bash
   flyctl auth login
   ```

### 2. Launch Your App

From your project directory:

```bash
flyctl launch
```

This will:
- Detect your `Dockerfile`
- Create a `fly.toml` configuration file
- Create the app on Fly.io

When prompted:
- Choose a region close to your users
- Say **No** to PostgreSQL and Redis (unless you need them)
- Say **No** to deploy now (we will set secrets first)

### 3. Set Environment Variables

```bash
flyctl secrets set BOT_TOKEN=<your-bot-token-from-botfather>
```

For webhook mode:
```bash
flyctl secrets set BOT_TOKEN=<your-bot-token-from-botfather> WEBHOOK_URL=https://your-app.fly.dev/webhook
flyctl secrets set WEBHOOK_SECRET=<random-hex-secret>
```

> Secrets are encrypted and not visible after setting. Use `flyctl secrets list` to see which secrets are set.

### 4. Get Fly.io API Token

```bash
flyctl tokens create deploy -x 999999h
```

Copy the token output.

### 5. Add GitHub Secrets

Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:

| Secret | Value | Where to find it |
|--------|-------|-------------------|
| `FLY_API_TOKEN` | Deploy token | `flyctl tokens create deploy` output |

### 6. Deploy

1. Bump version: `npm run version:patch`
2. Commit and push
3. Go to **Actions** tab > **Deploy to Fly.io** > **Run workflow**

The workflow runs CI first, then deploys to Fly.io and creates a GitHub Release.

---

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `BOT_TOKEN` | Bot token from BotFather | Yes | — |
| `WEBHOOK_URL` | Full webhook URL (e.g., `https://app.fly.dev/webhook`) | No | — (uses polling) |
| `WEBHOOK_SECRET` | Random secret used to verify Telegram webhook requests | Yes when `WEBHOOK_URL` is set | — |
| `PORT` | HTTP port for webhook server | No | `3000` |

---

## Polling vs Webhook in Production

| | Long Polling | Webhook |
|---|---|---|
| Setup | No public URL needed | Requires HTTPS URL |
| Latency | Slightly higher | Lower (push-based) |
| Resource usage | Constant connection | On-demand |
| Multiple instances | Only one allowed | Supports load balancing |
| Best for | Simple bots, Railway | High traffic, Fly.io |

**Recommendation:**
- **Railway**: Use long polling (default) — it works out of the box
- **Fly.io**: Use webhook mode — set `WEBHOOK_URL` to `https://your-app.fly.dev/webhook`

---

## Scaling

### Railway

- Railway auto-scales based on your plan
- Free tier: 500 hours/month, 512 MB RAM
- Pro tier ($5/month): unlimited hours, configurable resources
- Monitor usage in the Railway dashboard under **Metrics**

### Fly.io

- Scale with the CLI:
  ```bash
  # Scale memory
  flyctl scale memory 512

  # Scale VM count (requires webhook mode)
  flyctl scale count 2

  # View current scale
  flyctl scale show
  ```
- Free tier: 3 shared-cpu VMs, 256 MB RAM each
- Monitor with `flyctl status` and `flyctl logs`

> **Note:** Scaling to multiple instances only works with webhook mode. Long polling allows only one connection per bot token.

---

## Troubleshooting

### Bot deploys but goes offline

- Check logs: `flyctl logs` (Fly.io) or Railway dashboard > **Logs**
- Verify `BOT_TOKEN` is set correctly in environment variables
- Make sure the token has not been revoked — check with BotFather `/token`

### "Conflict: terminated by other getUpdates request"

- Another instance is using the same bot token with polling
- Stop local development servers before deploying
- If using multiple instances, switch to webhook mode

### "No Dockerfile found" error

- Make sure `Dockerfile` is in the root of your repository
- Check that it is committed to git (not in `.gitignore`)

### Railway deploy fails with "service not found"

- Verify `RAILWAY_SERVICE_ID` matches your service
- Make sure the Railway token has access to the project

### Fly.io deploy fails with "app not found"

- Run `flyctl launch` first to create the app
- Make sure `fly.toml` is committed to git
- Verify the app name in `fly.toml` matches your Fly.io app

### Webhook returns errors after deploy

- Verify `WEBHOOK_URL` ends with `/webhook` (or your configured path)
- Verify `WEBHOOK_SECRET` is set and matches the secret used by the running app
- Check that the URL uses HTTPS
- View webhook status: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Re-set the webhook if needed: the bot auto-registers it on startup

### Container crashes with out-of-memory

- Increase memory: `flyctl scale memory 512` (Fly.io) or upgrade plan (Railway)
- grammY bots typically need 64-128 MB RAM
- Check for memory leaks in your handler code
