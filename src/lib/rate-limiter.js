/**
 * Simple per-user rate limiter for bot commands.
 * @param {number} maxHits - Maximum allowed invocations within the window.
 * @param {number} windowMs - Time window in milliseconds.
 * @returns {{
 *   check: (key: string) => { limited: boolean, retryAfterMs: number },
 *   cleanup: () => void,
 *   dispose: () => void,
 *   _size: () => number,
 * }}
 */
function createRateLimiter(maxHits = 5, windowMs = 60_000) {
  const store = new Map();

  // Automatic cleanup of stale entries every window cycle. `.unref()` keeps
  // the timer from blocking process exit; tests should still call `dispose()`
  // in `afterEach` so `--detectOpenHandles` stays quiet and a windowMs-mid-test
  // tick cannot race the assertions.
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.start >= windowMs) store.delete(key);
    }
  }, windowMs);
  cleanupInterval.unref();

  return {
    /**
     * Check whether the given key is rate-limited.
     * @param {string} key - Unique identifier (e.g., user ID).
     * @returns {{ limited: boolean, retryAfterMs: number }}
     */
    check(key) {
      const now = Date.now();
      let entry = store.get(key);
      if (!entry || now - entry.start >= windowMs) {
        entry = { start: now, count: 0 };
        store.set(key, entry);
      }
      entry.count++;
      if (entry.count > maxHits) {
        // `Date.now()` is wall-clock, not monotonic — an NTP correction can
        // make `now < entry.start`, producing a negative elapsed and a
        // retryAfterMs larger than the window. Clamp into [0, windowMs] so
        // clients never see a nonsensical wait.
        const elapsed = now - entry.start;
        const remaining = Math.max(0, Math.min(windowMs, windowMs - elapsed));
        return { limited: true, retryAfterMs: remaining };
      }
      return { limited: false, retryAfterMs: 0 };
    },

    /** Periodic cleanup of stale entries. */
    cleanup() {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now - entry.start >= windowMs) store.delete(key);
      }
    },

    /**
     * Stop the background cleanup interval and drop all entries. Long-running
     * processes don't need this (the interval is `.unref()`'d), but tests must
     * call it so jest's open-handle detector stays clean and so a different
     * test's mocked `Date.now` cannot race the real-time interval.
     */
    dispose() {
      clearInterval(cleanupInterval);
      store.clear();
    },

    /** Internal: current entry count. Exposed for tests; do not rely on this in production code. */
    _size() {
      return store.size;
    },
  };
}

module.exports = { createRateLimiter };
