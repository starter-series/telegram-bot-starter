# Fly.io Deployment Guide

## 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## 2. Create a Fly App

```bash
cp fly.toml.example fly.toml
fly launch --no-deploy
```

Edit `fly.toml` and update the app name.

## 3. Set Secrets

```bash
fly secrets set BOT_TOKEN=your-bot-token
```

For webhook mode (optional):

```bash
fly secrets set WEBHOOK_URL=https://your-app.fly.dev PORT=3000
```

## 4. Get Deploy Token

```bash
fly tokens create deploy -x 999999h
```

Copy the token.

## 5. Add GitHub Secret

Go to your repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `FLY_API_TOKEN` | Your Fly.io deploy token |

## 6. Deploy

1. Bump version: `npm run version:patch`
2. Commit and push
3. Go to **Actions** tab → **Deploy to Fly.io** → **Run workflow**

## Troubleshooting

### Bot doesn't respond
- Check logs: `fly logs`
- Verify secrets: `fly secrets list`
- If using webhook, check that the URL matches: `fly status`

### Deploy fails
- Verify `fly.toml` exists and has correct app name
- Check Docker build locally: `docker build -t test .`
- Ensure `FLY_API_TOKEN` is set correctly
