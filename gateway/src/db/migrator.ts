/**
 * Migration runner. Reads `NNN-name.sql` files from a directory in lexical
 * order and applies any that haven't been recorded in `_mayordomia_migrations`.
 *
 * Conventions:
 *   - File name pattern: `^\d{3}-[a-z0-9-]+\.sql$` (e.g. `001-initial-schema.sql`).
 *   - Each file is one SQL script; multiple statements separated by `;`.
 *   - A migration is a single unit: if any statement fails, the whole file
 *     rolls back and the error propagates.
 *   - We use a real table (`_mayordomia_migrations`) instead of PRAGMA
 *     `user_version` because we want timestamps for debugging and the
 *     user_version field is capped at 65535 (good enough but timestamp is
 *     nicer in the health endpoint).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './client.js';
import { ApiError } from '../errors.js';

const MIGRATIONS_TABLE = '_mayordomia_migrations';

/**
 * Resolve the default migrations directory relative to this module's source
 * location. Works in both `tsx`/vitest (resolves to `src/db/migrations/`) and
 * the compiled `dist/` tree (resolves to `dist/db/migrations/` after the
 * postbuild copy step in package.json).
 */
export function defaultMigrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, 'migrations');
}

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: string;
}

export interface ApplyMigrationsResult {
  applied: AppliedMigration[];
  total: number;
}

const FILENAME_RE = /^(\d{3})-([a-z0-9-]+)\.sql$/;

export function applyMigrations(db: Db, migrationsDir: string): ApplyMigrationsResult {
  ensureMigrationsTable(db);

  const files = readdirSync(migrationsDir)
    .filter((f) => FILENAME_RE.test(f))
    .sort();
  if (files.length === 0) {
    return { applied: [], total: 0 };
  }

  const appliedVersions = new Set(
    (db.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`).all() as Array<{ version: number }>).map(
      (r) => r.version,
    ),
  );

  const applied: AppliedMigration[] = [];
  for (const file of files) {
    const match = FILENAME_RE.exec(file);
    if (!match) continue;
    const version = Number.parseInt(match[1]!, 10);
    const name = match[2]!;
    if (appliedVersions.has(version)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    try {
      db.exec('BEGIN');
      db.exec(sql);
      db.prepare(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name, applied_at) VALUES (?, ?, ?)`,
      ).run(version, name, new Date().toISOString());
      db.exec('COMMIT');
      applied.push({ version, name, appliedAt: new Date().toISOString() });
    } catch (err) {
      db.exec('ROLLBACK');
      throw ApiError.internal(
        'MIGRATION_FAILED',
        `Migration ${file} fall\u00f3: ${(err as Error).message}`,
      );
    }
  }

  return { applied, total: files.length };
}

export function listAppliedMigrations(db: Db): AppliedMigration[] {
  ensureMigrationsTable(db);
  return db
    .prepare(
      `SELECT version, name, applied_at AS appliedAt FROM ${MIGRATIONS_TABLE} ORDER BY version`,
    )
    .all() as unknown as AppliedMigration[];
}

function ensureMigrationsTable(db: Db): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );
}
