<div align="center">

# Telegram Bot Starter

**grammY + Docker + GitHub Actions CI/CD + one-click deploy.**

Build your bot. Push to deploy.

[![CI](https://github.com/starter-series/telegram-bot-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/starter-series/telegram-bot-starter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![grammY](https://img.shields.io/badge/grammY-v1-009dca.svg)](https://grammy.dev)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://www.docker.com/)

**English** | [한국어](README.ko.md)

</div>

---

> **Part of [Starter Series](https://github.com/starter-series/starter-series)** — Stop explaining CI/CD to your AI every time. Clone and start.
>
> [Docker Deploy](https://github.com/starter-series/docker-deploy-starter) · [Discord Bot](https://github.com/starter-series/discord-bot-starter) · **Telegram Bot** · [Browser Extension](https://github.com/starter-series/browser-extension-starter) · [Electron App](https://github.com/starter-series/electron-app-starter) · [npm Package](https://github.com/starter-series/npm-package-starter) · [React Native](https://github.com/starter-series/react-native-starter) · [VS Code Extension](https://github.com/starter-series/vscode-extension-starter) · [MCP Server](https://github.com/starter-series/mcp-server-starter) · [Python MCP Server](https://github.com/starter-series/python-mcp-server-starter) · [Cloudflare Pages](https://github.com/starter-series/cloudflare-pages-starter)

---

## Quick Start

```bash
# 1. Click "Use this template" on GitHub (or clone)
git clone https://github.com/starter-series/telegram-bot-starter.git my-bot
cd my-bot

# 2. Install dependencies
npm install

# 3. Set up environment (see docs/TELEGRAM_SETUP.md for detailed guide)
cp .env.example .env
# Edit .env → add BOT_TOKEN from @BotFather

# 4. Start the bot
npm run dev
```

## What's Included

```
├── src/
│   ├── index.js                  # Entry point (polling or webhook)
│   ├── config.js                 # Environment config loader
│   ├── commands/                 # Bot commands (auto-loaded)
│   │   ├── start.js              # /start — greeting
│   │   └── help.js               # /help — list commands
│   ├── handlers/                 # Message handlers (auto-loaded)
│   │   └── echo.js               # Echo text messages
│   └── lib/
│       ├── health.js             # GET /health HTTP server
│       ├── logger.js             # Structured JSON logger
│       └── rate-limiter.js       # Per-user rate limiter
├── scripts/
│   └── bump-version.js           # Bump package.json version
├── tests/
│   ├── commands.test.js          # Command + handler tests
│   └── health.test.js            # Health endpoint tests
├── Dockerfile                    # Production container
├── docker-compose.yml            # Dev with hot reload
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # Audit, lint, test, Docker build
│   │   ├── cd-railway.yml        # Deploy to Railway
│   │   ├── cd-fly.yml            # Deploy to Fly.io
│   │   └── setup.yml             # Auto setup checklist on first use
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── TELEGRAM_SETUP.md         # BotFather setup guide
│   └── DEPLOY_GUIDE.md           # Railway & Fly.io deployment guide
└── package.json
```

## Features

- **grammY** — Modern, fast, lightweight Telegram bot framework
- **CI Pipeline** — Security audit, lint, test, Docker build verification on every push
- **CD Pipeline** — One-click deploy to Railway or Fly.io + auto GitHub Release
- **Docker** — Production Dockerfile + dev compose with hot reload
- **Polling & Webhook** — Long polling by default, webhook mode via env var
- **Health endpoint** — Built-in `GET /health` + Docker `HEALTHCHECK` so Fly.io / Railway can detect a crashed bot
- **Version management** — `npm run version:patch/minor/major` to bump `package.json`
- **Dev mode** — `npm run dev` for live reload with `node --watch`
- **Starter code** — `/start` + `/help` commands, echo handler, modular structure
- **Deploy guides** — Step-by-step docs for BotFather, Railway, and Fly.io
- **Template setup** — Auto-creates setup checklist issue on first use

## CI/CD

### CI (every PR + push to main)

| Step | What it does |
|------|-------------|
| Security audit | `npm audit` for dependency vulnerabilities |
| Lint | ESLint for code quality |
| Test | Jest (passes with no tests by default) |
| Docker build | Builds the container image to catch build errors |
| Trivy scan | Scans the container image for CRITICAL/HIGH CVEs |

### Security & Maintenance

| Workflow | What it does |
|----------|-------------|
| CodeQL (`codeql.yml`) | Static analysis for security vulnerabilities (push/PR + weekly) |
| Maintenance (`maintenance.yml`) | Weekly CI health check — auto-creates issue on failure |
| Stale (`stale.yml`) | Labels inactive issues/PRs after 30 days, auto-closes after 7 more |

### CD (manual trigger via Actions tab)

| Step | What it does |
|------|-------------|
| Version guard | Fails if git tag already exists for this version |
| Deploy | Pushes to Railway or Fly.io |
| GitHub Release | Creates a tagged release with auto-generated notes |

**How to deploy:**

1. Set up GitHub Secrets (see below)
2. Bump version: `npm run version:patch` (or `version:minor` / `version:major`)
3. Go to **Actions** tab → **Deploy to Railway** (or **Fly.io**) → **Run workflow**

### GitHub Secrets

#### Railway (`cd-railway.yml`)

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token |
| `RAILWAY_SERVICE_ID` | Target service ID |

See **[docs/DEPLOY_GUIDE.md](docs/DEPLOY_GUIDE.md)** for setup guide.

#### Fly.io (`cd-fly.yml`)

| Secret | Description |
|--------|-------------|
| `FLY_API_TOKEN` | Fly.io deploy token |

See **[docs/DEPLOY_GUIDE.md](docs/DEPLOY_GUIDE.md)** for setup guide.

## Development

```bash
# Start with hot reload
npm run dev

# Or use Docker
docker compose up

# Bump version (updates package.json)
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0

# Lint & test
npm run lint
npm test
```

## Adding Commands

Create a new file in `src/commands/`:

```js
// src/commands/echo.js
module.exports = {
  name: 'echo',
  description: 'Echo your message',
  async execute(ctx) {
    const text = ctx.match || 'Nothing to echo';
    await ctx.reply(text);
  },
};
```

Commands are auto-loaded — no need to edit any other file.

## Adding Handlers

Create a new file in `src/handlers/`:

```js
// src/handlers/photo.js
module.exports = {
  name: 'photo',
  register(bot) {
    bot.on('message:photo', async (ctx) => {
      await ctx.reply('Nice photo!');
    });
  },
};
```

Handlers are auto-loaded — no need to edit any other file.

## Why This Over Heavyweight Templates?

[donbarbos/telegram-bot-template](https://github.com/donbarbos/telegram-bot-template) (450+ stars) is the most complete Telegram bot template. This template takes a different approach:

|  | This template | donbarbos/telegram-bot-template |
|---|---|---|
| Philosophy | Thin starter with CI/CD | Full production stack |
| Framework | grammY (JS) | aiogram (Python) |
| Infrastructure | Docker only | Docker + PostgreSQL + Redis + Grafana |
| Dependencies | 2 runtime | 15+ |
| Learning curve | Read the grammY docs | Learn the full stack |
| CI/CD | Full pipeline included | Full pipeline included |
| AI/vibe-coding | LLMs generate clean JS | LLMs must handle Python + ORM + monitoring |
| Best for | Utility bots, simple automation | Large bots with DB, caching, monitoring |

**Choose this template if:**
- You want a lightweight bot that's easy to understand and extend
- You need production CI/CD + Docker without the heavyweight stack
- You're using AI tools to generate bot code — simple JS produces the cleanest output
- Your bot doesn't need a database or Redis

**Choose donbarbos if:**
- You need PostgreSQL, Redis, or monitoring from day one
- You prefer Python/aiogram over JavaScript/grammY
- You want a full production stack out of the box

### What about TypeScript?

This template uses JavaScript for simplicity. To add TypeScript:

1. Add `typescript` and `@types/node` to devDependencies
2. Add a `tsconfig.json`
3. Update `npm start` to build and run from `dist/`
4. Rename `.js` files to `.ts`

TypeScript is opt-in, not forced. For many bots, JavaScript is all you need.

## Health Check

The bot exposes a tiny HTTP health server (`src/lib/health.js`) so Docker, Fly.io, and Railway can detect a crashed or stuck bot process.

| Mode | Port | Endpoint |
|------|------|----------|
| Polling (default) | `HEALTH_PORT` (default `3000`) — standalone server | `GET /health` |
| Webhook (`WEBHOOK_URL` set) | `PORT` — mounted on the webhook server, no extra listener | `GET /health` |

| Status | Body |
|--------|------|
| `200 OK` (ready) | `{ "status": "ok", "uptime": <seconds>, "mode": "polling"\|"webhook" }` |
| `503 Service Unavailable` (starting / disconnected) | `{ "status": "starting", "uptime": <seconds>, "mode": "polling"\|"webhook" }` |

**Configuration**

```bash
# .env
HEALTH_PORT=3000   # polling mode only — change if 3000 is already taken
# PORT=3000        # webhook mode — /health is mounted on this port
```

**Fly.io** — add an HTTP service check to `fly.toml`:

```toml
[[http_service]]
  internal_port = 3000
  force_https = true

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "30s"
    method = "GET"
    path = "/health"
```

**Railway** — in the service's **Settings → Deploy**, set the health-check path to `/health` and the port to `3000`.

**Docker** — `docker ps` will show `(healthy)` / `(unhealthy)` automatically; the `HEALTHCHECK` runs `wget --spider http://localhost:${HEALTH_PORT}/health` every 30s.

## Contributing

PRs welcome. Please use the [PR template](.github/PULL_REQUEST_TEMPLATE.md).

## License

[MIT](LICENSE)
