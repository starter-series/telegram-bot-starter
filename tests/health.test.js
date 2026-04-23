const http = require('http');
const { createHealthServer, createHealthHandler } = require('../src/lib/health');

function fakeBot({ running = false, inited = false } = {}) {
  return {
    isRunning: () => running,
    isInited: () => inited,
  };
}

function get(port, path = '/health') {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
          headers: res.headers,
        });
      });
    });
    req.on('error', reject);
  });
}

describe('health server (polling mode)', () => {
  test('returns 200 + JSON with uptime/mode when bot.isRunning() is true', async () => {
    const bot = fakeBot({ running: true });
    // Port 0 → let the OS pick a free port so parallel runs don't collide.
    const server = createHealthServer(bot, { mode: 'polling', port: 0 });
    await server.start();
    const { port } = server.address();

    try {
      const res = await get(port);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/json');

      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.mode).toBe('polling');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    } finally {
      await server.stop();
    }
  });

  test('returns 503 when bot has not started polling', async () => {
    const bot = fakeBot({ running: false });
    const server = createHealthServer(bot, { mode: 'polling', port: 0 });
    await server.start();
    const { port } = server.address();

    try {
      const res = await get(port);
      expect(res.status).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('starting');
      expect(body.mode).toBe('polling');
    } finally {
      await server.stop();
    }
  });

  test('returns 404 for unknown paths', async () => {
    const bot = fakeBot({ running: true });
    const server = createHealthServer(bot, { mode: 'polling', port: 0 });
    await server.start();
    const { port } = server.address();

    try {
      const res = await get(port, '/nope');
      expect(res.status).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('not_found');
    } finally {
      await server.stop();
    }
  });
});

describe('health handler (webhook mode, mounted on existing server)', () => {
  // In webhook mode /health is mounted on grammY's webhook server. Simulate
  // that by using a fallback that returns a sentinel response so we can prove
  // the handler delegates non-/health traffic instead of 404-ing it.
  function mountedServer(bot) {
    const fallback = (req, res) => {
      res.writeHead(202, { 'Content-Type': 'text/plain' });
      res.end('webhook-ok');
    };
    const handler = createHealthHandler(bot, 'webhook', fallback);
    const server = http.createServer(handler);
    return new Promise((resolve) => {
      server.listen(0, () => resolve(server));
    });
  }

  test('returns 200 + mode=webhook when bot.isInited() is true', async () => {
    const bot = fakeBot({ inited: true });
    const server = await mountedServer(bot);
    const { port } = server.address();

    try {
      const res = await get(port);
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.mode).toBe('webhook');
    } finally {
      await new Promise((resolve) => server.close(() => resolve()));
    }
  });

  test('returns 503 when bot has not been initialized yet', async () => {
    const bot = fakeBot({ inited: false });
    const server = await mountedServer(bot);
    const { port } = server.address();

    try {
      const res = await get(port);
      expect(res.status).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('starting');
    } finally {
      await new Promise((resolve) => server.close(() => resolve()));
    }
  });

  test('delegates non-/health requests to the webhook fallback', async () => {
    const bot = fakeBot({ inited: true });
    const server = await mountedServer(bot);
    const { port } = server.address();

    try {
      const res = await get(port, '/webhook');
      // Proves /health mount doesn't shadow the webhook route.
      expect(res.status).toBe(202);
      expect(res.body).toBe('webhook-ok');
    } finally {
      await new Promise((resolve) => server.close(() => resolve()));
    }
  });
});
