import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  closeDatabase,
  applyMigrations,
  defaultMigrationsDir,
  type Db,
} from '../../src/db/index.js';
import { makeRepository, type Repository } from '../../src/repository/index.js';

describe('repository', () => {
  let db: Db;
  let repo: Repository;

  beforeEach(() => {
    db = openDatabase({ path: ':memory:' });
    applyMigrations(db, defaultMigrationsDir());
    repo = makeRepository(db);
    // Seed: one organization + one site.
    db.prepare(
      `INSERT INTO organizations (id, name, timezone, active, created_at, version) VALUES ('o1', 'Org', 'UTC', 1, '2026-01-01T00:00:00Z', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO sites (id, organization_id, name, address, active, created_at, version) VALUES ('s1', 'o1', 'Site', '', 1, '2026-01-01T00:00:00Z', 1)`,
    ).run();
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('rows returns camelCase keys matching handler expectations', async () => {
    const rows = await repo.rows('organizations');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'o1',
      name: 'Org',
      timezone: 'UTC',
      active: 1,
      version: 1,
    });
    expect(rows[0]).toHaveProperty('createdAt');
    expect(rows[0]).not.toHaveProperty('created_at');
  });

  it('findOne returns the first row matching the predicate', async () => {
    const found = await repo.findOne(
      'sites',
      (r) => r['id'] === 's1' && r['organizationId'] === 'o1',
    );
    expect(found).not.toBeNull();
    expect(found!['name']).toBe('Site');
  });

  it('findOne returns null when no row matches', async () => {
    const found = await repo.findOne('sites', (r) => r['id'] === 'nope');
    expect(found).toBeNull();
  });

  it('append inserts a row and converts camelCase keys to snake_case columns', async () => {
    await repo.append('users', {
      id: 'u1',
      organizationId: 'o1',
      email: 'a@b.com',
      name: 'Alice',
      status: 'ACTIVE',
      createdAt: '2026-02-01T00:00:00Z',
      version: 1,
    });
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get('u1') as Record<string, unknown>;
    expect(row).toMatchObject({
      id: 'u1',
      organization_id: 'o1',
      email: 'a@b.com',
      name: 'Alice',
      status: 'ACTIVE',
    });
  });

  it('updateWhere updates by id and returns true on match', async () => {
    const updated = await repo.updateWhere('sites', 'id', 's1', {
      name: 'New Name',
      updatedAt: '2026-02-02T00:00:00Z',
    });
    expect(updated).toBe(true);
    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get('s1') as Record<string, unknown>;
    expect(row['name']).toBe('New Name');
    expect(row['updated_at']).toBe('2026-02-02T00:00:00Z');
  });

  it('updateWhere returns false when no row matches', async () => {
    const updated = await repo.updateWhere('sites', 'id', 'does-not-exist', { name: 'X' });
    expect(updated).toBe(false);
  });

  it('throws on unknown table', async () => {
    await expect(repo.rows('bogus_table')).rejects.toThrow(/unknown table/);
  });
});
