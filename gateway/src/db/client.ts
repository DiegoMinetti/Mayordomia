/**
 * SQLite database client. Thin wrapper around `node:sqlite` (stable since
 * Node 22.5) so call sites depend on our interface, not the built-in.
 *
 * Behavior:
 *   - File paths open with `journal_mode = WAL` for concurrent reads.
 *   - `:memory:` opens in-memory (for tests).
 *   - `foreign_keys = ON` is set unconditionally — SQLite ships with FK off
 *     by default, and we want referential integrity.
 *   - `synchronous = NORMAL` is the standard pair with WAL: safe on power
 *     loss, faster than FULL.
 *
 * We load `node:sqlite` via `process.getBuiltinModule()` rather than a static
 * import so vitest's vite-node bundler doesn't strip the `node:` prefix and
 * try to resolve it as an npm package. The runtime call is opaque to the
 * bundler and works identically in tsx and compiled dist/.
 */
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ApiError } from '../errors.js';

type NodeSqliteModule = typeof import('node:sqlite');
let cachedModule: NodeSqliteModule | undefined;
function loadNodeSqlite(): NodeSqliteModule {
  if (cachedModule) return cachedModule;
  // process.getBuiltinModule is available in Node 22.3+; we're on >=22.5.
  const mod = (
    process as NodeJS.Process & { getBuiltinModule(id: string): NodeSqliteModule }
  ).getBuiltinModule('node:sqlite');
  cachedModule = mod;
  return mod;
}

export type Db = import('node:sqlite').DatabaseSync;

export interface OpenDatabaseOptions {
  /** Absolute or relative path to the .db file. `:memory:` for in-memory. */
  path: string;
  /** Create parent dirs if missing. Default: true for file paths, ignored for :memory:. */
  ensureDir?: boolean;
}

export function openDatabase(opts: OpenDatabaseOptions): Db {
  const { DatabaseSync } = loadNodeSqlite();
  const isMemory = opts.path === ':memory:';
  if (!isMemory && opts.ensureDir !== false) {
    mkdirSync(dirname(opts.path), { recursive: true });
  }
  let db: Db;
  try {
    db = new DatabaseSync(opts.path);
  } catch (err) {
    throw ApiError.internal(
      'DB_OPEN_FAILED',
      `No se pudo abrir SQLite en ${opts.path}: ${(err as Error).message}`,
    );
  }
  db.exec('PRAGMA foreign_keys = ON');
  if (!isMemory) {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
  }
  return db;
}

/** Run a SELECT and return one row (or undefined). Helper for health checks. */
export function probeDb(db: Db): { ok: true; userVersion: number } | { ok: false; error: string } {
  try {
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
    return { ok: true, userVersion: row?.user_version ?? 0 };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function closeDatabase(db: Db): void {
  db.close();
}
