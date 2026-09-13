import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openDatabase,
  closeDatabase,
  applyMigrations,
  listAppliedMigrations,
  defaultMigrationsDir,
  type Db,
} from '../../src/db/index.js';

describe('db.migrator', () => {
  let db: Db;
  let tmpDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    db = openDatabase({ path: ':memory:' });
    tmpDir = mkdtempSync(join(tmpdir(), 'mayordomia-mig-test-'));
    migrationsDir = join(tmpDir, 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    closeDatabase(db);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns applied=[] when the migrations directory is empty', () => {
    const result = applyMigrations(db, migrationsDir);
    expect(result.applied).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('applies migrations in lexical order and records them', () => {
    writeFileSync(join(migrationsDir, '002-add-index.sql'), 'CREATE INDEX idx_t_name ON t(name);');
    writeFileSync(
      join(migrationsDir, '001-create-tables.sql'),
      'CREATE TABLE t(id INTEGER PRIMARY KEY, name TEXT);',
    );

    const result = applyMigrations(db, migrationsDir);
    expect(result.applied.map((m) => m.version)).toEqual([1, 2]);
    expect(result.total).toBe(2);

    const applied = listAppliedMigrations(db);
    expect(applied.map((m) => m.version)).toEqual([1, 2]);
    expect(applied[0]?.appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is idempotent: a second call applies nothing', () => {
    writeFileSync(join(migrationsDir, '001-init.sql'), 'CREATE TABLE t(id INTEGER PRIMARY KEY);');
    const first = applyMigrations(db, migrationsDir);
    const second = applyMigrations(db, migrationsDir);
    expect(first.applied).toHaveLength(1);
    expect(second.applied).toEqual([]);
    expect(second.total).toBe(1);
  });

  it('rolls back the failed migration and rethrows with the code MIGRATION_FAILED', () => {
    writeFileSync(join(migrationsDir, '001-good.sql'), 'CREATE TABLE t(id INTEGER PRIMARY KEY);');
    writeFileSync(join(migrationsDir, '002-bad.sql'), 'CREATE TABLE t(id INTEGER);'); // duplicate name
    // The wrapper ApiError carries code='MIGRATION_FAILED' in its `code` field.
    // The thrown error's message starts with "Migration 002-bad.sql falló:".
    expect(() => applyMigrations(db, migrationsDir)).toThrow(/falló/);
    try {
      applyMigrations(db, migrationsDir);
    } catch (err) {
      expect((err as { code?: string }).code).toBe('MIGRATION_FAILED');
    }
    // The first migration DID commit because the migrator runs them one at a
    // time (no global transaction). The second one fails and is rolled back
    // individually. 001 stays applied — that's the correct behavior.
    const applied = listAppliedMigrations(db);
    expect(applied.map((m) => m.version)).toEqual([1]);
  });

  it('ignores files that do not match the NNN-name.sql pattern', () => {
    writeFileSync(join(migrationsDir, 'README.md'), '# not a migration');
    writeFileSync(join(migrationsDir, '001-init.sql'), 'CREATE TABLE t(id INTEGER PRIMARY KEY);');
    const result = applyMigrations(db, migrationsDir);
    expect(result.applied).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('defaultMigrationsDir resolves to a directory that contains 001-initial-schema.sql', async () => {
    const dir = defaultMigrationsDir();
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(dir);
    expect(files.some((f) => /^001-.*\.sql$/.test(f))).toBe(true);
  });
});
