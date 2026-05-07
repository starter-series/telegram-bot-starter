<div align="center">

# Telegram Bot Starter

**grammY + Docker + GitHub Actions CI/CD + 원클릭 배포.**

봇을 만들고, 푸시하면 배포됩니다.

[![CI](https://github.com/starter-series/telegram-bot-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/starter-series/telegram-bot-starter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![grammY](https://img.shields.io/badge/grammY-v1-009dca.svg)](https://grammy.dev)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://www.docker.com/)

[English](README.md) | **한국어**

</div>

---

> **[Starter Series](https://github.com/starter-series/starter-series)** — 매번 AI한테 CI/CD 설명하지 마세요. clone하고 바로 시작하세요.
>
> [Docker Deploy](https://github.com/starter-series/docker-deploy-starter) · [Discord Bot](https://github.com/starter-series/discord-bot-starter) · **Telegram Bot** · [Browser Extension](https://github.com/starter-series/browser-extension-starter) · [Electron App](https://github.com/starter-series/electron-app-starter) · [npm Package](https://github.com/starter-series/npm-package-starter) · [React Native](https://github.com/starter-series/react-native-starter) · [VS Code Extension](https://github.com/starter-series/vscode-extension-starter) · [MCP Server](https://github.com/starter-series/mcp-server-starter) · [Python MCP Server](https://github.com/starter-series/python-mcp-server-starter) · [Cloudflare Pages](https://github.com/starter-series/cloudflare-pages-starter)

---

## 빠른 시작

**[create-starter](https://github.com/starter-series/create-starter) 사용** (권장):

```bash
npx @starter-series/create my-telegram-bot --template telegram-bot
cd my-telegram-bot && npm install
cp .env.example .env  # @BotFather에서 받은 BOT_TOKEN 입력
npm run dev
```

**또는 직접 clone:**

```bash
git clone https://github.com/starter-series/telegram-bot-starter my-telegram-bot
cd my-telegram-bot && npm install
cp .env.example .env
npm run dev
```

BotFather 상세 가이드는 [docs/TELEGRAM_SETUP.md](docs/TELEGRAM_SETUP.md) 참고.

## 구성

```
├── src/
│   ├── index.js                  # 진입점 (폴링 또는 웹훅)
│   ├── config.js                 # 환경변수 로더
│   ├── commands/                 # 봇 커맨드 (자동 로드)
│   │   ├── start.js              # /start — 인사
│   │   └── help.js               # /help — 커맨드 목록
│   ├── handlers/                 # 메시지 핸들러 (자동 로드)
│   │   └── echo.js               # 텍스트 에코
│   └── lib/
│       ├── health.js             # GET /health HTTP 서버
│       ├── logger.js             # 구조화 JSON 로거
│       └── rate-limiter.js       # 사용자별 레이트 리미터
├── scripts/
│   └── bump-version.js           # 버전 범프
├── tests/
│   ├── commands.test.js          # 커맨드 + 핸들러 테스트
│   └── health.test.js            # 헬스 엔드포인트 테스트
├── Dockerfile                    # 프로덕션 컨테이너
├── docker-compose.yml            # 핫 리로드 개발
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # 보안 감사, 린트, 테스트, Docker 빌드
│   │   ├── cd-railway.yml        # Railway 배포
│   │   ├── cd-fly.yml            # Fly.io 배포
│   │   └── setup.yml             # 첫 사용 시 체크리스트 자동 생성
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── TELEGRAM_SETUP.md         # BotFather 설정 가이드
│   └── DEPLOY_GUIDE.md           # Railway & Fly.io 배포 가이드
└── package.json
```

## 기능

- **grammY** — 모던하고 빠른 경량 텔레그램 봇 프레임워크
- **CI 파이프라인** — 보안 감사, 린트, 테스트, Docker 빌드 검증
- **CD 파이프라인** — 원클릭 Railway 또는 Fly.io 배포 + GitHub Release 자동 생성
- **Docker** — 프로덕션 Dockerfile + 핫 리로드 개발 compose
- **폴링 & 웹훅** — 기본은 롱 폴링, 환경변수로 웹훅 모드 전환
- **헬스 체크** — `GET /health` + Docker `HEALTHCHECK` 내장 — Fly.io / Railway가 죽은 봇을 감지
- **버전 관리** — `npm run version:patch/minor/major`
- **개발 모드** — `npm run dev`로 `node --watch` 라이브 리로드
- **스타터 코드** — `/start` + `/help` 커맨드, 에코 핸들러, 모듈러 구조
- **배포 가이드** — BotFather, Railway, Fly.io 단계별 문서
- **템플릿 셋업** — 첫 사용 시 체크리스트 이슈 자동 생성

## CI/CD

### CI (PR + main 푸시마다)

| 단계 | 설명 |
|------|------|
| 보안 감사 | `npm audit`로 의존성 취약점 검사 |
| 린트 | ESLint 코드 품질 검사 |
| 테스트 | Jest (기본은 테스트 없어도 통과) |
| Docker 빌드 | 컨테이너 이미지 빌드로 오류 사전 감지 |
| Trivy 스캔 | 컨테이너 이미지의 CRITICAL/HIGH CVE 취약점 스캔 |

### 보안 & 유지보수

| 워크플로우 | 역할 |
|-----------|------|
| CodeQL (`codeql.yml`) | 보안 취약점 정적 분석 (push/PR + 주간) |
| Maintenance (`maintenance.yml`) | 주간 CI 헬스 체크 — 실패 시 이슈 자동 생성 |
| Stale (`stale.yml`) | 비활성 이슈/PR 30일 후 라벨링, 7일 후 자동 종료 |

### CD (Actions 탭에서 수동 실행)

| 단계 | 설명 |
|------|------|
| 버전 확인 | 이미 존재하는 태그면 실패 |
| 배포 | Railway 또는 Fly.io에 배포 |
| GitHub Release | 자동 릴리스 노트와 함께 태그 생성 |

**배포 방법:**

1. GitHub Secrets 설정 (아래 참고)
2. 버전 범프: `npm run version:patch`
3. **Actions** 탭 → **Deploy to Railway** (또는 **Fly.io**) → **Run workflow**

### GitHub Secrets

#### Railway (`cd-railway.yml`)

| Secret | 설명 |
|--------|------|
| `RAILWAY_TOKEN` | Railway API 토큰 |
| `RAILWAY_SERVICE_ID` | 대상 서비스 ID |

자세한 설정은 **[docs/DEPLOY_GUIDE.md](docs/DEPLOY_GUIDE.md)** 참고.

#### Fly.io (`cd-fly.yml`)

| Secret | 설명 |
|--------|------|
| `FLY_API_TOKEN` | Fly.io 배포 토큰 |

자세한 설정은 **[docs/DEPLOY_GUIDE.md](docs/DEPLOY_GUIDE.md)** 참고.

## 개발

```bash
# 핫 리로드로 시작
npm run dev

# Docker 사용
docker compose up

# 버전 범프
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0

# 린트 & 테스트
npm run lint
npm test
```

## 커맨드 추가

`src/commands/`에 새 파일 생성:

```js
// src/commands/echo.js
module.exports = {
  name: 'echo',
  description: '메시지 에코',
  async execute(ctx) {
    const text = ctx.match || '에코할 내용이 없습니다';
    await ctx.reply(text);
  },
};
```

커맨드는 자동 로드됩니다 — 다른 파일 수정 불필요.

## 핸들러 추가

`src/handlers/`에 새 파일 작성:

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

핸들러도 자동 로드됩니다 — 다른 파일 수정 불필요.

## 왜 무거운 템플릿 대신 이걸 쓰나요?

[donbarbos/telegram-bot-template](https://github.com/donbarbos/telegram-bot-template) (450+ stars)이 가장 완성도 높은 Telegram 봇 템플릿입니다. 이 템플릿은 다른 접근법:

|  | 이 템플릿 | donbarbos/telegram-bot-template |
|---|---|---|
| 철학 | CI/CD 갖춘 얇은 starter | 풀 프로덕션 스택 |
| 프레임워크 | grammY (JS) | aiogram (Python) |
| 인프라 | Docker만 | Docker + PostgreSQL + Redis + Grafana |
| 의존성 | 런타임 2개 | 15+ |
| 러닝커브 | grammY 문서만 보면 됨 | 풀 스택 학습 필요 |
| CI/CD | 풀 파이프라인 제공 | 풀 파이프라인 제공 |
| AI/vibe-coding | LLM이 깔끔한 JS 생성 | LLM이 Python + ORM + 모니터링 모두 처리 필요 |
| 적합 사례 | 유틸리티 봇, 간단한 자동화 | DB·캐싱·모니터링 갖춘 대형 봇 |

**이 템플릿을 선택할 때:**
- 이해·확장하기 쉬운 가벼운 봇이 필요
- 무거운 스택 없이 프로덕션 CI/CD + Docker만 필요
- AI 도구로 봇 코드 생성 — 간단한 JS가 가장 깔끔한 출력
- 봇이 DB나 Redis가 필요 없는 경우

**donbarbos를 선택할 때:**
- 첫날부터 PostgreSQL, Redis, 모니터링이 필요
- JavaScript/grammY보다 Python/aiogram 선호
- 풀 프로덕션 스택을 즉시 원함

### TypeScript는?

이 템플릿은 단순함을 위해 JavaScript 사용. TypeScript 추가하려면:

1. `typescript`와 `@types/node`를 devDependencies에 추가
2. `tsconfig.json` 추가
3. `npm start`를 build 후 `dist/`에서 실행하도록 수정
4. `.js` 파일을 `.ts`로 리네임

TypeScript는 강제가 아닌 opt-in. 많은 봇에는 JavaScript로 충분.

## 헬스 체크

봇은 작은 HTTP 헬스 서버(`src/lib/health.js`)를 엽니다. Docker, Fly.io, Railway가 봇 프로세스 크래시/연결 끊김을 감지하는 용도입니다.

| 모드 | 포트 | 엔드포인트 |
|------|------|-----------|
| 폴링 (기본) | `HEALTH_PORT` (기본값 `3000`) — 별도 서버 | `GET /health` |
| 웹훅 (`WEBHOOK_URL` 설정 시) | `PORT` — 웹훅 서버에 마운트, 추가 리스너 없음 | `GET /health` |

| 상태 | 응답 |
|------|------|
| `200 OK` (ready) | `{ "status": "ok", "uptime": <초>, "mode": "polling"\|"webhook" }` |
| `503 Service Unavailable` (시작 중 / 연결 끊김) | `{ "status": "starting", "uptime": <초>, "mode": "polling"\|"webhook" }` |

**설정**

```bash
# .env
HEALTH_PORT=3000   # 폴링 모드 전용 — 3000이 사용 중이면 변경
# PORT=3000        # 웹훅 모드 — 이 포트에 /health가 마운트됨
```

**Fly.io** — `fly.toml`에 HTTP 서비스 체크 추가:

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

**Railway** — 서비스의 **Settings → Deploy**에서 헬스 체크 경로를 `/health`, 포트를 `3000`으로 설정.

**Docker** — `docker ps`가 자동으로 `(healthy)` / `(unhealthy)` 상태를 표시합니다. `HEALTHCHECK`는 30초마다 `wget --spider http://localhost:${HEALTH_PORT}/health`를 실행합니다.

## 기여

PR 환영합니다. [PR 템플릿](.github/PULL_REQUEST_TEMPLATE.md)을 사용해 주세요.

## 라이선스

[MIT](LICENSE)
