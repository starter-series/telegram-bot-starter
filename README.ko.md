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
> [Docker Deploy](https://github.com/starter-series/docker-deploy-starter) · [Discord Bot](https://github.com/starter-series/discord-bot-starter) · [Telegram Bot](https://github.com/starter-series/telegram-bot-starter) · [Browser Extension](https://github.com/starter-series/browser-extension-starter) · [Electron App](https://github.com/starter-series/electron-app-starter) · [npm Package](https://github.com/starter-series/npm-package-starter) · [React Native](https://github.com/starter-series/react-native-starter) · [VS Code Extension](https://github.com/starter-series/vscode-extension-starter) · [MCP Server](https://github.com/starter-series/mcp-server-starter)

---

## 빠른 시작

```bash
# 1. GitHub에서 "Use this template" 클릭 (또는 clone)
git clone https://github.com/starter-series/telegram-bot-starter.git my-bot
cd my-bot

# 2. 의존성 설치
npm install

# 3. 환경 설정 (자세한 가이드: docs/TELEGRAM_SETUP.md)
cp .env.example .env
# .env 편집 → @BotFather에서 받은 BOT_TOKEN 입력

# 4. 봇 시작
npm run dev
```

## 구성

```
├── src/
│   ├── index.js                  # 진입점 (폴링 또는 웹훅)
│   ├── config.js                 # 환경변수 로더
│   ├── commands/                 # 봇 커맨드 (자동 로드)
│   │   ├── start.js              # /start — 인사
│   │   └── help.js               # /help — 커맨드 목록
│   └── handlers/                 # 메시지 핸들러 (자동 로드)
│       └── echo.js               # 텍스트 에코
├── scripts/
│   └── bump-version.js           # 버전 범프
├── tests/
│   └── commands.test.js          # 구조 검증 테스트
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

## 기여

PR 환영합니다. [PR 템플릿](.github/PULL_REQUEST_TEMPLATE.md)을 사용해 주세요.

## 라이선스

[MIT](LICENSE)
