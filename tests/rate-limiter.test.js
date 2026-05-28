const { createRateLimiter } = require('../src/lib/rate-limiter');

// Every limiter created in this file owns a real-time `setInterval` (see
// `cleanupInterval` in src/lib/rate-limiter.js). Without `.dispose()` the
// timers stay armed for the rest of the process; `jest --detectOpenHandles`
// would flag every one of them. Track and tear down per test.
const limiters = [];
function makeLimiter(...args) {
  const lim = createRateLimiter(...args);
  limiters.push(lim);
  return lim;
}
afterEach(() => {
  while (limiters.length) limiters.pop().dispose();
});

describe('createRateLimiter', () => {
  test('first call to a fresh key is not limited', () => {
    const limiter = makeLimiter(3, 60_000);
    expect(limiter.check('u1')).toEqual({ limited: false, retryAfterMs: 0 });
  });

  test('allows exactly maxHits in a window, blocks the next', () => {
    const limiter = makeLimiter(3, 60_000);
    expect(limiter.check('u1').limited).toBe(false); // 1
    expect(limiter.check('u1').limited).toBe(false); // 2
    expect(limiter.check('u1').limited).toBe(false); // 3
    const fourth = limiter.check('u1');
    // Boundary: `entry.count > maxHits` — 4th call must trip.
    expect(fourth.limited).toBe(true);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
    expect(fourth.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  test('keys are isolated — one user limited does not affect another', () => {
    const limiter = makeLimiter(2, 60_000);
    limiter.check('u1');
    limiter.check('u1');
    expect(limiter.check('u1').limited).toBe(true);
    // u2 is fresh, should pass.
    expect(limiter.check('u2').limited).toBe(false);
  });

  test('counter resets after the window elapses', () => {
    const now0 = 1_000_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now0);
    try {
      const limiter = makeLimiter(2, 60_000);
      limiter.check('u1'); // count=1 at now0
      limiter.check('u1'); // count=2
      expect(limiter.check('u1').limited).toBe(true); // 3rd, blocked

      // Advance past the window.
      spy.mockReturnValue(now0 + 60_001);
      // The check() path detects `now - entry.start >= windowMs` and creates
      // a fresh entry, so the next call must pass.
      expect(limiter.check('u1').limited).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test('retryAfterMs shrinks as time elapses inside the window', () => {
    const now0 = 1_000_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now0);
    try {
      const limiter = makeLimiter(1, 60_000);
      limiter.check('u1'); // count=1 at now0

      spy.mockReturnValue(now0 + 10_000);
      const r1 = limiter.check('u1');
      expect(r1.limited).toBe(true);
      expect(r1.retryAfterMs).toBe(50_000);

      spy.mockReturnValue(now0 + 59_000);
      const r2 = limiter.check('u1');
      expect(r2.limited).toBe(true);
      expect(r2.retryAfterMs).toBe(1_000);
    } finally {
      spy.mockRestore();
    }
  });

  test('retryAfterMs clamps to [0, windowMs] when Date.now() jumps backward', () => {
    // `Date.now()` is wall-clock, not monotonic. An NTP correction can step
    // backward, making `now - entry.start` negative and the un-clamped
    // formula return a value larger than windowMs. Clients computing
    // sleep-then-retry from that value would wait far longer than the
    // limiter's own bucket.
    const now0 = 1_000_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now0);
    try {
      const limiter = makeLimiter(1, 60_000);
      limiter.check('u1');
      // Time travels back 10s relative to entry.start (NTP correction).
      spy.mockReturnValue(now0 - 10_000);
      const r = limiter.check('u1');
      expect(r.limited).toBe(true);
      expect(r.retryAfterMs).toBeGreaterThanOrEqual(0);
      expect(r.retryAfterMs).toBeLessThanOrEqual(60_000);
    } finally {
      spy.mockRestore();
    }
  });

  test('cleanup() empties the internal store for stale entries', () => {
    const now0 = 1_000_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now0);
    try {
      const limiter = makeLimiter(3, 60_000);
      limiter.check('u1');
      limiter.check('u2');
      expect(limiter._size()).toBe(2);

      // Advance past the window so both entries are stale.
      spy.mockReturnValue(now0 + 60_001);
      limiter.cleanup();
      // The actual contract: cleanup REMOVED the entries from the store.
      // (The previous test relied on `check()` returning `limited:false`
      // after cleanup — but `check()` also resets stale entries, so the
      // assertion passed even if `cleanup()` was a no-op.)
      expect(limiter._size()).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  test('dispose() clears the cleanup interval and drops all entries', () => {
    const limiter = createRateLimiter(3, 60_000); // do NOT register with makeLimiter — own dispose
    limiter.check('u1');
    limiter.check('u2');
    expect(limiter._size()).toBe(2);
    limiter.dispose();
    expect(limiter._size()).toBe(0);
    // Calling dispose twice must not throw.
    expect(() => limiter.dispose()).not.toThrow();
  });

  test('default arguments cap at 5 hits / 60s', () => {
    const limiter = makeLimiter(); // defaults
    for (let i = 0; i < 5; i += 1) {
      expect(limiter.check('u1').limited).toBe(false);
    }
    expect(limiter.check('u1').limited).toBe(true);
  });
});
