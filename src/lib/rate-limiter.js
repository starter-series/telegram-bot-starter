/**
 * Simple per-user rate limiter for bot commands.
 * @param {number} maxHits - Maximum allowed invocations within the window.
 * @param {number} windowMs - Time window in milliseconds.
 */
function createRateLimiter(maxHits = 5, windowMs = 60_000) {
  const store = new Map();

  // Automatic cleanup of stale entries every window cycle
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
        return { limited: true, retryAfterMs: windowMs - (now - entry.start) };
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
  };
}

module.exports = { createRateLimiter };
