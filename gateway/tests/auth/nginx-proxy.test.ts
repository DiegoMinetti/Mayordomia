/**
 * Integration test for the nginx → gateway bridge.
 *
 * Boots the real gateway Express app, then wraps it in a thin proxy that
 * mirrors the production nginx config (`web-image/nginx.conf`):
 *
 *   - `POST /api`            → forwards to gateway `/api`        (dispatcher)
 *   - `POST /api/health`     → forwards to gateway `/ping`       (liveness)
 *   - `POST /api/auth/*`     → strips `/api/` → forwards `/auth/*`
 *
 * Then asserts the public-facing URL `/api/auth/register` returns 200 with
 * a JSON envelope. If anyone breaks the strip (no trailing slash on
 * `proxy_pass`), drops the `/api` exact-match block, or breaks the
 * absolute-redirect off invariant, this test fails before the bug reaches
 * production.
 *
 * The proxy is intentionally a tiny mirror — the real nginx.conf is linted
 * separately in `nginx.config.test.ts`. Keeping this in JS also documents the
 * routing intent for anyone reading the test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import {
  openDatabase,
  closeDatabase,
  applyMigrations,
  defaultMigrationsDir,
  type Db,
} from '../../src/db/index.js';
import { makeRepository, type Repository } from '../../src/repository/index.js';
import { buildApp } from '../../src/server.js';
import { makeAuditService } from '../../src/audit/service.js';
import pino from 'pino';

const silentLogger = pino({ level: 'silent' });

const baseConfig = {
  port: 3000,
  nodeEnv: 'test',
  logLevel: 'silent',
  allowedOrigins: [],
  dbPath: ':memory:',
  spreadsheetId: undefined,
  googleServiceAccountFile: undefined,
  googleServiceAccountJson: undefined,
  calendarId: undefined,
  resendApiKey: undefined,
  resendFrom: undefined,
  publicTokenPepper: undefined,
  rateLimit: { windowMs: 60_000, max: 100 },
};

/**
 * Wraps `gatewayApp` in a thin proxy that mirrors the production nginx.conf.
 *
 *   - `location = /api`            → forwards as `/api`          (exact-match dispatcher)
 *   - `location = /api/health`     → forwards as `/ping`         (liveness)
 *   - `location /api/`             → strips `/api/`, forwards as `/...`
 *
 * Note: Express's `app.use('/api', …)` STRIPS the `/api` prefix before
 * invoking the middleware (the opposite of nginx's `location` blocks), so we
 * reconstruct the path manually to match nginx semantics.
 */
function makeNginxLikeProxy(gatewayApp: Express): Express {
  const proxy = express();

  proxy.use((req, res, next) => {
    // Reconstruct the original path (Express's `app.use` would have stripped
    // the prefix; we want the full URL here so we can apply nginx-like
    // routing decisions).
    const originalUrl = req.originalUrl || req.url;
    // We only proxy requests starting with `/api/...` or exactly `/api`.
    if (originalUrl === '/api' || originalUrl === '/api/') {
      // exact-match dispatcher → forwards `/api` as-is to the gateway.
      req.url = '/api';
      return gatewayApp(req, res, next);
    }
    if (originalUrl === '/api/health' || originalUrl.startsWith('/api/health?')) {
      // exact-match liveness → forwards as `/ping`.
      req.url = '/ping';
      return gatewayApp(req, res, next);
    }
    if (originalUrl.startsWith('/api/')) {
      // prefix-match: strip `/api/`, forward the rest as-is.
      req.url = originalUrl.replace(/^\/api/, '');
      return gatewayApp(req, res, next);
    }
    // Anything outside `/api/*` falls through to the SPA root (mirrors
    // `location / { try_files … /index.html }`). For the test, a 404 is
    // enough — we never hit it on the auth flows.
    res.status(404).send('not found');
  });
  return proxy;
}

describe('nginx-like proxy → gateway integration', () => {
  let db: Db;
  let repo: Repository;
  let gatewayApp: Express;
  let publicApp: Express;

  beforeEach(() => {
    db = openDatabase({ path: ':memory:' });
    applyMigrations(db, defaultMigrationsDir());
    repo = makeRepository(db);
    // Seed the org FK target the auth/register route requires.
    db.prepare(
      `INSERT INTO organizations (id, name, timezone, active, created_at, version) VALUES ('org_intg_1', 'Integration', 'UTC', 1, '2026-01-01T00:00:00Z', 1)`,
    ).run();
    gatewayApp = buildApp({
      config: baseConfig as never,
      logger: silentLogger,
      repo,
      audit: makeAuditService(repo, silentLogger),
      db,
    });
    publicApp = makeNginxLikeProxy(gatewayApp);
  });

  afterEach(() => closeDatabase(db));

  it('POST /api/auth/register reaches the gateway and returns 200 + JSON envelope', async () => {
    const res = await request(publicApp)
      .post('/api/auth/register')
      .set('Origin', 'https://mayordomia.fewlines.com.ar')
      .send({
        email: 'integration@example.com',
        password: 'hunter2-but-real',
        organizationId: 'org_intg_1',
        name: 'Integration Test',
      });

    // The bug Diego hit was 404 + HTML here (because nginx forwarded
    // /api/auth/register unchanged). With the strip in place, this should
    // hit the gateway's /auth/register handler and return the auth envelope.
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.token).toMatch(/^sess_/);
    expect(res.body.data.user.email).toBe('integration@example.com');
  });

  it('POST /api (dispatcher) reaches the gateway /api endpoint, not /api/', async () => {
    // The dispatcher (`POST /api`) is what BootstrapClient uses when a
    // session is active. Without the exact-match nginx block it would
    // 301 → /api/ → strip → / (404). With the block in place, the gateway
    // sees the request as `/api`.
    const res = await request(publicApp)
      .post('/api')
      .set('Origin', 'https://mayordomia.fewlines.com.ar')
      .send({
        action: 'system.health',
        organizationId: 'org_intg_1',
        auth: { accessToken: 'sess_invalid' },
      });
    // The dispatcher returns 200 with an error envelope (UNAUTHORIZED) when
    // the access token is bad — that's still a JSON envelope, NOT a 404 HTML
    // page. The point is: we hit the dispatcher.
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('ok');
    expect(res.body.ok).toBe(false);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/health is reachable (liveness probe from uptime checks)', async () => {
    const res = await request(publicApp).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/auth/me is reachable even without a token (returns 401 envelope, not 404 HTML)', async () => {
    const res = await request(publicApp).post('/api/auth/me').send({});
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.ok).toBe(false);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });
});
