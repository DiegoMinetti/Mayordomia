import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, probeDb, closeDatabase } from '../../src/db/index.js';

describe('db.client', () => {
  const tmpDirs: string[] = [];

  function freshTmp(): string {
    const dir = mkdtempSync(join(tmpdir(), 'mayordomia-db-test-'));
    tmpDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    while (tmpDirs.length > 0) {
      const d = tmpDirs.pop();
      if (d) rmSync(d, { recursive: true, force: true });
    }
  });

  it('opens an in-memory database and turns foreign keys on', () => {
    const db = openDatabase({ path: ':memory:' });
    const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(fk.foreign_keys).toBe(1);
    closeDatabase(db);
  });

  it('uses WAL journal mode on a file-backed database', () => {
    const dir = freshTmp();
    const db = openDatabase({ path: join(dir, 'test.db') });
    const jm = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(jm.journal_mode.toLowerCase()).toBe('wal');
    closeDatabase(db);
  });

  it('creates parent directories for a file-backed database', () => {
    const dir = freshTmp();
    const nested = join(dir, 'a', 'b', 'c', 'test.db');
    const db = openDatabase({ path: nested });
    db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY)');
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='t'").get();
    expect(row).toEqual({ name: 't' });
    closeDatabase(db);
  });

  it('probeDb returns ok=true for a healthy database', () => {
    const db = openDatabase({ path: ':memory:' });
    const result = probeDb(db);
    expect(result.ok).toBe(true);
    closeDatabase(db);
  });

  it('openDatabase wraps I/O failures in DB_OPEN_FAILED', () => {
    expect(() => openDatabase({ path: '/this/path/does/not/exist/x/y/db.db' })).toThrow(
      /DB_OPEN_FAILED|ENOENT/,
    );
  });
});
