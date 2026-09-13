import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  closeDatabase,
  applyMigrations,
  defaultMigrationsDir,
  type Db,
} from '../../src/db/index.js';
import { makeRepository, type Repository } from '../../src/repository/index.js';
import {
  createSession,
  findSession,
  revokeSession,
  revokeAllSessionsForUser,
  newSessionToken,
  isSessionToken,
  hashSessionToken,
  SESSION_PREFIX,
} from '../../src/auth/sessions.js';

describe('auth.sessions', () => {
  let db: Db;
  let repo: Repository;

  beforeEach(async () => {
    db = openDatabase({ path: ':memory:' });
    applyMigrations(db, defaultMigrationsDir());
    repo = makeRepository(db);
    // Seed an organization + user so the FK on sessions.user_id resolves.
    db.prepare(
      `INSERT INTO organizations (id, name, timezone, active, created_at, version) VALUES ('o1', 'Org', 'UTC', 1, '2026-01-01T00:00:00Z', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO users (id, organization_id, email, name, status, created_at, version) VALUES ('u1', 'o1', 'a@b.com', 'A', 'ACTIVE', '2026-01-01T00:00:00Z', 1)`,
    ).run();
  });

  afterEach(() => closeDatabase(db));

  it('newSessionToken produces a sess_-prefixed base64url string', () => {
    const token = newSessionToken();
    expect(token.startsWith(SESSION_PREFIX)).toBe(true);
    expect(token.length).toBe(SESSION_PREFIX.length + 43);
    expect(isSessionToken(token)).toBe(true);
  });

  it('hashSessionToken produces a 64-char hex digest', () => {
    const token = newSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('isSessionToken rejects malformed tokens', () => {
    expect(isSessionToken(undefined)).toBe(false);
    expect(isSessionToken('not-sess')).toBe(false);
    expect(isSessionToken('bearer_xxx')).toBe(false);
    expect(isSessionToken(SESSION_PREFIX + 'short')).toBe(false);
  });

  it('createSession stores a hashable row keyed by token hash', async () => {
    const { token, session } = await createSession(repo, { userId: 'u1', organizationId: 'o1' });
    expect(session.userId).toBe('u1');
    expect(session.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const row = db.prepare('SELECT id FROM sessions WHERE id = ?').get(hashSessionToken(token));
    expect(row).toEqual({ id: hashSessionToken(token) });
  });

  it('findSession returns null for unknown tokens', async () => {
    expect(await findSession(repo, newSessionToken())).toBeNull();
  });

  it('findSession returns the session for a valid token', async () => {
    const { token } = await createSession(repo, { userId: 'u1', organizationId: 'o1' });
    const found = await findSession(repo, token);
    expect(found?.userId).toBe('u1');
  });

  it('findSession returns null for a revoked token', async () => {
    const { token } = await createSession(repo, { userId: 'u1', organizationId: 'o1' });
    await revokeSession(repo, token);
    expect(await findSession(repo, token)).toBeNull();
  });

  it('revokeAllSessionsForUser revokes only that user', async () => {
    db.prepare(
      `INSERT INTO users (id, organization_id, email, name, status, created_at, version) VALUES ('u2', 'o1', 'c@d.com', 'C', 'ACTIVE', '2026-01-01T00:00:00Z', 1)`,
    ).run();
    await createSession(repo, { userId: 'u1', organizationId: 'o1' });
    await createSession(repo, { userId: 'u1', organizationId: 'o1' });
    await createSession(repo, { userId: 'u2', organizationId: 'o1' });
    const count = await revokeAllSessionsForUser(repo, 'u1');
    expect(count).toBe(2);
    const remaining = (await repo.rows('sessions')).filter((r) => !r['revokedAt']);
    expect(remaining).toHaveLength(1);
    expect(String(remaining[0]?.['userId'])).toBe('u2');
  });
});
