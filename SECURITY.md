# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue.**
2. Email **heznpc@gmail.com** or use [GitHub Security Advisories](../../security/advisories/new).
3. Include steps to reproduce, impact assessment, and suggested fix if possible.

We will respond within 48 hours and work with you to resolve the issue.

## Security Features

This template includes automated security checks in CI:

- **Dependency audit** — `npm audit` on every push (HIGH/CRITICAL threshold)
- **Secret leak detection** — [gitleaks](https://github.com/gitleaks/gitleaks) scans every commit
- **Dependency updates** — [Dependabot](https://docs.github.com/en/code-security/dependabot) monitors for vulnerable dependencies

## Best Practices

- Never commit `.env` files or secrets — they are gitignored by default
- Use GitHub Secrets for deployment credentials
- Keep dependencies up to date by merging Dependabot PRs
- **Command injection** — Never pass user message content to `child_process.exec()` or `eval()`. If your bot runs shell commands, use `execFile()` with explicit argument arrays and validate all inputs against an allowlist.
- **Markup injection** — When using `parse_mode: 'HTML'` or `'MarkdownV2'` in a reply, escape user-provided text first. grammY's `ctx.reply()` defaults to plain text and is safe; an attacker who controls the bot input can otherwise forge fake links, fake buttons, or fake system messages. See [grammY parse-mode docs](https://grammy.dev/guide/formatting).

## Logged data

This starter writes JSON log lines (`src/lib/logger.js`) to stdout. The default
echo handler logs the Telegram numeric user id (as the field `userId`) when a
message is rate-limited (`src/handlers/echo.js`), and the bot logs its own
lifecycle events. **It does not log message text or chat IDs.**

Telegram `user.id` is a pseudonymous identifier under GDPR/CCPA. If you ship
this starter to production, decide on:

- **Retention** — how long the log aggregator keeps records.
- **Masking** — whether to hash the user id before logging in environments
  where the raw value is not needed for debugging.
- **Subject access / deletion** — how a user can request removal.

The starter intentionally does not pick a policy. Configure your log pipeline
(Vector, Fluent Bit, CloudWatch, Loki, Datadog, etc.) to match the obligations
of your jurisdiction.
