import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import {
  openDatabase,
  closeDatabase,
  applyMigrations,
  defaultMigrationsDir,
  type Db,
} from '../../src/db/index.js';
import { buildApp } from '../../src/server.js';
import { makeAuditService } from '../../src/audit/service.js';
import type { Repository } from '../../src/repo/client.js';
import type { Config } from '../../src/config.js';

// Real pino logger to silence output — the vi.fn()-based fake breaks pino-http
// because pino-http reads `logger.levels` and other internals.
const silentLogger = pino({ level: 'silent' });

const baseConfig: Config = {
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

function fakeRepo(): Repository {
  return {
    raw: {} as never,
    spreadsheetId: 'ss-test',
    rows: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    append: vi.fn().mockResolvedValue(undefined),
    updateWhere: vi.fn().mockResolvedValue(false),
    close: vi.fn(),
  };
}

describe('db boot integration', () => {
  it('GET /ping works without a DB handle (back-compat)', async () => {
    const app = buildApp({
      config: baseConfig,
      logger: silentLogger,
      repo: fakeRepo(),
      audit: makeAuditService(fakeRepo(), silentLogger),
    });
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OK');
  });

  it('GET /ping works with a DB handle', async () => {
    const db: Db = openDatabase({ path: ':memory:' });
    applyMigrations(db, defaultMigrationsDir());
    const app = buildApp({
      config: baseConfig,
      logger: silentLogger,
      repo: fakeRepo(),
      audit: makeAuditService(fakeRepo(), silentLogger),
      db,
    });
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OK');
    closeDatabase(db);
  });

  it('system.health reports sqlite OK with tables count when DB is wired', async () => {
    const db = openDatabase({ path: ':memory:' });
    const { applied } = applyMigrations(db, defaultMigrationsDir());
    const { makeHealthHandlers } = await import('../../src/routes/health.js');
    const health = makeHealthHandlers({ repo: fakeRepo(), config: baseConfig, db });
    const result = await health.check({}, { requestId: 'test', auth: undefined });

    expect(result.sqlite).toMatchObject({
      status: 'OK',
      tables: 27,
      migrationsApplied: applied.length,
    });
    expect(applied.length).toBeGreaterThan(0);
    closeDatabase(db);
  });

  it('system.health reports sqlite NOT_CONFIGURED when no DB is passed', async () => {
    const { makeHealthHandlers } = await import('../../src/routes/health.js');
    const health = makeHealthHandlers({ repo: fakeRepo(), config: baseConfig });
    const result = await health.check({}, { requestId: 'test', auth: undefined });
    expect(result.sqlite).toEqual({ status: 'NOT_CONFIGURED' });
  });
});
