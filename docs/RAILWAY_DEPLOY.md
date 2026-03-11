# Railway Deployment Guide

## 1. Create a Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway will detect the Dockerfile automatically

## 2. Set Environment Variables

In Railway dashboard → your service → **Variables**:

```
BOT_TOKEN=your-bot-token
```

For webhook mode (optional):

```
WEBHOOK_URL=https://your-app.up.railway.app
PORT=3000
```

## 3. Get Deployment Credentials

### Railway Token

1. Go to [railway.app/account/tokens](https://railway.app/account/tokens)
2. Create a new token
3. Copy it

### Service ID

1. Go to your project → click on your service
2. Open **Settings** tab
3. Copy the **Service ID** from the URL or settings

## 4. Add GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `RAILWAY_TOKEN` | Your Railway API token |
| `RAILWAY_SERVICE_ID` | Your service ID |

## 5. Deploy

1. Bump version: `npm run version:patch`
2. Commit and push
3. Go to **Actions** tab → **Deploy to Railway** → **Run workflow**

## Troubleshooting

### Bot doesn't respond
- Check Railway logs for errors
- Verify `BOT_TOKEN` is set correctly in Railway Variables
- If using webhook, ensure `WEBHOOK_URL` matches Railway's assigned domain

### Deploy fails
- Check that `RAILWAY_TOKEN` and `RAILWAY_SERVICE_ID` are correct
- Verify Docker build works locally: `docker build -t test .`
