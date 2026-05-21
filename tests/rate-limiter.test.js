const { createRateLimiter } = require('../src/lib/rate-limiter');

describe('createRateLimiter', () => {
  test('first call to a fresh key is not limited', () => {
    const limiter = createRateLimiter(3, 60_000);
    expect(limiter.check('u1')).toEqual({ limited: false, retryAfterMs: 0 });
  });

  test('allows exactly maxHits in a window, blocks the next', () => {
    const limiter = createRateLimiter(3, 60_000);
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
    const limiter = createRateLimiter(2, 60_000);
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
      const limiter = createRateLimiter(2, 60_000);
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
      const limiter = createRateLimiter(1, 60_000);
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

  test('cleanup() removes stale entries past the window', () => {
    const now0 = 1_000_000_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now0);
    try {
      const limiter = createRateLimiter(3, 60_000);
      limiter.check('u1');
      limiter.check('u2');
      // Advance past the window so both entries are stale.
      spy.mockReturnValue(now0 + 60_001);
      limiter.cleanup();
      // After cleanup, a fresh check must not see the prior counter.
      const r = limiter.check('u1');
      expect(r.limited).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test('default arguments cap at 5 hits / 60s', () => {
    const limiter = createRateLimiter(); // defaults
    for (let i = 0; i < 5; i += 1) {
      expect(limiter.check('u1').limited).toBe(false);
    }
    expect(limiter.check('u1').limited).toBe(true);
  });
});
