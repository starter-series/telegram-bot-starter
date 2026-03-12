# Telegram Bot Starter

grammY Telegram bot with Docker, CI/CD, and Railway/Fly.io deployment.

## Project Structure

```
src/
  index.js        → Entry point (polling or webhook based on WEBHOOK_URL env)
  config.js       → Environment variable validation
  commands/       → Bot commands (registered via bot.command())
  handlers/       → Message/callback handlers
scripts/
  bump-version.js → Version bumping
Dockerfile        → Node 20 Alpine, production build
docker-compose.yml → Local dev
.env.example      → BOT_TOKEN, optional WEBHOOK_URL + PORT
```

## CI/CD Pipeline

- **ci.yml**: Push/PR to main. npm audit + ESLint + Jest + Docker build. No secrets.
- **cd-railway.yml**: Manual trigger. CI gate → Railway deploy → GitHub Release.
- **cd-fly.yml**: Manual trigger. CI gate → Fly.io deploy → GitHub Release.
- **setup.yml**: First push only. Creates setup checklist Issue.

## Secrets

| Secret | For | Required |
|--------|-----|----------|
| `RAILWAY_TOKEN` | Railway deploy | If using Railway |
| `RAILWAY_SERVICE_ID` | Railway deploy | If using Railway |
| `FLY_API_TOKEN` | Fly.io deploy | If using Fly.io |

## What to Modify

- `src/commands/` → Add bot commands
- `src/handlers/` → Add message/callback handlers
- `.env.example` → Add your environment variables
- `package.json` → Update name, description
- Version → `npm run version:patch|minor|major`

## Do NOT Modify

- Dual-mode logic in `src/index.js`
  - **Why**: WEBHOOK_URL 유무로 polling/webhook 자동 전환. 로컬에서는 polling, Railway/Fly.io에서는 webhook. 이 분기를 건드리면 배포 환경에서 봇이 메시지를 못 받음.
- `src/config.js` → Env validation
  - **Why**: BOT_TOKEN 없이 실행하면 grammY가 불명확한 에러를 던짐. config.js가 시작 시 명확한 에러 메시지로 fail-fast.
- Version guard logic
  - **Why**: 같은 버전 태그로 재배포 시 GitHub Release 충돌.

## Dual Mode

- **Polling** (default): No WEBHOOK_URL set. Bot polls Telegram for updates. Good for dev.
- **Webhook**: Set WEBHOOK_URL + PORT. Bot starts HTTP server. Required for production on Railway/Fly.io.

## Key Patterns

- grammY framework (lightweight Telegram bot library)
- Polling for local dev, webhook for production
- `config.js` validates BOT_TOKEN at startup (fails fast)
