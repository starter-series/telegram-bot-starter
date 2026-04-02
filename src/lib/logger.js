const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const level = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function log(severity, context, message, extra) {
  if (LEVELS[severity] < level) return;
  const entry = {
    ts: new Date().toISOString(),
    level: severity,
    ctx: context,
    msg: message,
    ...(extra && { extra }),
  };
  const out = JSON.stringify(entry);
  severity === "error" ? console.error(out) : console.log(out);
}

module.exports = {
  debug: (ctx, msg, extra) => log("debug", ctx, msg, extra),
  info: (ctx, msg, extra) => log("info", ctx, msg, extra),
  warn: (ctx, msg, extra) => log("warn", ctx, msg, extra),
  error: (ctx, msg, extra) => log("error", ctx, msg, extra),
};
