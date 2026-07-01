const nodeTimers = require('node:timers');

function setTimer(fn, ms) {
  const timer =
    typeof globalThis.setTimeout === 'function'
      ? globalThis.setTimeout(fn, ms)
      : nodeTimers.setTimeout(fn, ms);
  return timer;
}

function clearTimer(timer) {
  if (typeof globalThis.clearTimeout === 'function') {
    globalThis.clearTimeout(timer);
    return;
  }
  nodeTimers.clearTimeout(timer);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimer(resolve, ms);
  });
}

module.exports = {
  clearTimer,
  delay,
  setTimer,
};
