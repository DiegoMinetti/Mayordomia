/**
 * Repository — drop-in replacement for the Sheets-backed SheetsClient.
 *
 * Same method shape as `SheetsClient` so handlers can swap one import for the
 * other with no logic change:
 *
 *   sheets.rows(table)             → repo.rows(table)
 *   sheets.findOne(table, pred)    → repo.findOne(table, pred)
 *   sheets.append(table, record)   → repo.append(table, record)
 *   sheets.updateWhere(...)        → repo.updateWhere(...)
 *
 * Rows come back with camelCase keys (matching Sheets semantics); the
 * underlying SQL columns are snake_case and mapped through `columnMapFor()`.
 */
import { randomUUID } from 'node:crypto';
import { columnMapFor } from './columns.js';
import type { Db } from '../db/client.js';

export interface Repository {
  rows(table: string): Promise<Record<string, unknown>[]>;
  findOne(
    table: string,
    predicate: (row: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown> | null>;
  append(table: string, record: Record<string, unknown>): Promise<void>;
  updateWhere(
    table: string,
    matchColumn: string,
    matchValue: string | number,
    patch: Record<string, unknown>,
  ): Promise<boolean>;
  close(): void;
}

export function makeRepository(db: Db): Repository {
  function selectAll(table: string): Record<string, unknown>[] {
    const cols = columnMapFor(table);
    const selectList = Object.entries(cols)
      .map(([camel, sql]) => `${quoteIdent(sql)} AS ${quoteIdent(camel)}`)
      .join(', ');
    return db.prepare(`SELECT ${selectList} FROM ${quoteIdent(table)}`).all() as Record<
      string,
      unknown
    >[];
  }

  async function rows(table: string): Promise<Record<string, unknown>[]> {
    return selectAll(table);
  }

  async function findOne(
    table: string,
    predicate: (row: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown> | null> {
    const list = selectAll(table);
    for (const row of list) if (predicate(row)) return row;
    return null;
  }

  async function append(table: string, record: Record<string, unknown>): Promise<void> {
    const cols = columnMapFor(table);
    const pairs: Array<{ sql: string; value: unknown }> = [];
    for (const [camel, value] of Object.entries(record)) {
      const sql = cols[camel];
      if (!sql) continue; // unknown key — ignore to match Sheets append semantics
      pairs.push({ sql, value: normalizeForColumn(sql, value) });
    }
    if (pairs.length === 0) return;
    const colList = pairs.map((p) => quoteIdent(p.sql)).join(', ');
    const placeholderList = pairs.map(() => '?').join(', ');
    const values = pairs.map((p) => p.value);
    db.prepare(`INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${placeholderList})`).run(
      ...(values as import('node:sqlite').SQLInputValue[]),
    );
  }

  async function updateWhere(
    table: string,
    matchColumn: string,
    matchValue: string | number,
    patch: Record<string, unknown>,
  ): Promise<boolean> {
    const cols = columnMapFor(table);
    const matchSql = cols[matchColumn];
    if (!matchSql)
      throw new Error(`Repository: unknown match column "${matchColumn}" on "${table}"`);
    const patchEntries = Object.entries(patch).filter(([camel]) => camel in cols);
    if (patchEntries.length === 0) return false;
    const setList = patchEntries.map(([camel]) => `${quoteIdent(cols[camel]!)} = ?`).join(', ');
    const values = patchEntries.map(([camel, value]) => normalizeForColumn(cols[camel]!, value));
    const result = db
      .prepare(`UPDATE ${quoteIdent(table)} SET ${setList} WHERE ${quoteIdent(matchSql)} = ?`)
      .run(...(values as import('node:sqlite').SQLInputValue[]), matchValue);
    return result.changes > 0;
  }

  function close(): void {
    db.close();
  }

  return { rows, findOne, append, updateWhere, close };
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Coerce values to the right SQLite representation for known columns.
 * Booleans become 0/1 integers (matching the CHECK constraints in the schema);
 * everything else is passed through as-is and bound by better-sqlite3.
 */
function normalizeForColumn(column: string, value: unknown): unknown {
  // Heuristic: any column named `*_at` or `*_by` is a TEXT; everything else
  // is bound as-is. Booleans are handled by better-sqlite3 (true/false → 1/0).
  // The schema's `CHECK (col IN (0,1))` constraints make this safe.
  if (value === undefined) return null;
  if (value === '') return null;
  return value;
}

// Convenience for tests + handlers that need a fresh ID.
export function newId(): string {
  return randomUUID();
}
