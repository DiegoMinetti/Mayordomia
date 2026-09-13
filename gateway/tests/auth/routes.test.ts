import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import { createHash } from 'node:crypto';

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

describe('auth.routes (HTTP)', () => {
  let db: Db;
  let repo: Repository;

  beforeEach(() => {
    db = openDatabase({ path: ':memory:' });
    applyMigrations(db, defaultMigrationsDir());
    repo = makeRepository(db);
    // Seed the organizations the auth routes reference (FK targets).
    db.prepare(
      `INSERT INTO organizations (id, name, timezone, active, created_at, version) VALUES ('org_test123', 'Test', 'UTC', 1, '2026-01-01T00:00:00Z', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO organizations (id, name, timezone, active, created_at, version) VALUES ('org_seed1234', 'Seed', 'UTC', 1, '2026-01-01T00:00:00Z', 1)`,
    ).run();
  });

  afterEach(() => closeDatabase(db));

  function makeApp() {
    return buildApp({
      config: baseConfig as never,
      logger: silentLogger,
      repo,
      audit: makeAuditService(repo, silentLogger),
      db,
    });
  }

  it('POST /auth/register creates a user and returns a session token + cookie', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'hunter2-but-real',
        organizationId: 'org_test123',
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.token).toMatch(/^sess_/);
    expect(res.body.data.user.email).toBe('admin@example.com');
    expect(res.headers['set-cookie']?.[0]).toMatch(/^mayordomia_session=sess_/);
  });

  it('POST /auth/login succeeds for the right password', async () => {
    const app = makeApp();
    await request(app)
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'hunter2-but-real',
        organizationId: 'org_test123',
      });
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'hunter2-but-real',
        organizationId: 'org_test123',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toMatch(/^sess_/);
  });

  it('POST /auth/login fails for the wrong password', async () => {
    const app = makeApp();
    await request(app)
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'hunter2-but-real',
        organizationId: 'org_test123',
      });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'WRONG', organizationId: 'org_test123' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /auth/login is case-insensitive on email', async () => {
    const app = makeApp();
    await request(app)
      .post('/auth/register')
      .send({
        email: 'Admin@Example.com',
        password: 'hunter2-but-real',
        organizationId: 'org_test123',
      });
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'hunter2-but-real',
        organizationId: 'org_test123',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toMatch(/^sess_/);
  });

  it('POST /auth/me returns the current user when the cookie is valid', async () => {
    const app = makeApp();
    const reg = await request(app)
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'hunter2-but-real', organizationId: 'org_test123' });
    const cookie = reg.headers['set-cookie']?.[0] ?? '';
    const res = await request(app).post('/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('a@b.com');
  });

  it('POST /auth/logout revokes the session so /auth/me fails after', async () => {
    const app = makeApp();
    const reg = await request(app)
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'hunter2-but-real', organizationId: 'org_test123' });
    const cookie = reg.headers['set-cookie']?.[0] ?? '';
    await request(app).post('/auth/logout').set('Cookie', cookie);
    const me = await request(app).post('/auth/me').set('Cookie', cookie);
    expect(me.body.ok).toBe(false);
  });

  it('POST /auth/register rejects duplicate email/org pairs', async () => {
    const app = makeApp();
    await request(app)
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'hunter2-but-real', organizationId: 'org_test123' });
    const dup = await request(app)
      .post('/auth/register')
      .send({ email: 'A@B.com', password: 'hunter2-but-real', organizationId: 'org_test123' });
    expect(dup.body.error.code).toBe('USER_EXISTS');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'short', organizationId: 'org_test123' });
    expect(res.body.ok).toBe(false);
  });

  it('seeded token works against /api auth-protected route', async () => {
    const app = makeApp();
    // Seed a user + role assignment + permission.
    const now = new Date().toISOString();
    await repo.append('users', {
      id: 'u1',
      organizationId: 'org_seed1234',
      email: 'seed@b.com',
      name: 'Seed',
      status: 'ACTIVE',
      passwordHash: '$2a$12$00000000000000000000000000000000000000000000000000000000',
      createdAt: now,
      version: 1,
    });
    const token = 'sess_' + 'a'.repeat(43);
    const sessionId = createHash('sha256').update(token).digest('hex');
    await repo.append('sessions', {
      id: sessionId,
      userId: 'u1',
      organizationId: 'org_seed1234',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: now,
      revokedAt: '',
      userAgent: '',
      ip: '',
    });

    // The /api route expects an action it doesn't know about — but auth still runs first.
    const res = await request(app)
      .post('/api')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'nonexistent.action', organizationId: 'org_seed1234' });
    expect(res.body.error.code).toBe('NOT_FOUND'); // auth resolved, action just unknown
  });
});
