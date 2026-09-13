/**
 * Google Sheets API client wrapper. Replaces SpreadsheetApp.openById() with
 * the official googleapis SDK using a Service Account.
 *
 * Two auth modes:
 *   - File path (preferred for production: docker secret mount at /run/secrets)
 *   - Inline JSON (fallback for local dev without a file)
 */
import { google, type sheets_v4 } from 'googleapis';
import { existsSync } from 'node:fs';
import type { Config } from '../config.js';
import { ApiError } from '../errors.js';
import type { Logger } from '../logging.js';

export interface SheetsClient {
  raw: sheets_v4.Sheets;
  spreadsheetId: string;
  /** Read all rows of a sheet (header row consumed, returns Record<string, unknown>[]). */
  rows: (sheet: string) => Promise<Record<string, unknown>[]>;
  /** Find the first row matching the predicate. */
  findOne: (
    sheet: string,
    predicate: (row: Record<string, unknown>) => boolean,
  ) => Promise<Record<string, unknown> | null>;
  /** Append a record (header-aware: writes only known columns). */
  append: (sheet: string, record: Record<string, unknown>) => Promise<void>;
  /** Update a row by matching column. Returns true if a row was updated. */
  updateWhere: (
    sheet: string,
    matchColumn: string,
    matchValue: string | number,
    patch: Record<string, unknown>,
  ) => Promise<boolean>;
  /** Close underlying HTTP connections. */
  close: () => void;
}

export async function createSheetsClient(config: Config, logger: Logger): Promise<SheetsClient> {
  // SPREADSHEET_ID is required during the Sheets→SQLite migration window
  // (verified in createServer() before calling this). PR 2 removes this
  // dependency entirely.
  if (!config.spreadsheetId) {
    throw ApiError.internal(
      'CONFIG_MISSING',
      'SPREADSHEET_ID is required to initialize the Sheets client.',
    );
  }
  const ssId: string = config.spreadsheetId;

  let auth: object;
  if (config.googleServiceAccountFile) {
    if (!existsSync(config.googleServiceAccountFile)) {
      throw ApiError.internal(
        'CONFIG_MISSING',
        `No se encontró GOOGLE_SERVICE_ACCOUNT_FILE=${config.googleServiceAccountFile}`,
      );
    }
    auth = await google.auth.getClient({
      keyFile: config.googleServiceAccountFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    logger.info({ file: config.googleServiceAccountFile }, 'sheets auth: file');
  } else if (config.googleServiceAccountJson) {
    const credentials = JSON.parse(config.googleServiceAccountJson) as object;
    auth = await google.auth.getClient({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    logger.info('sheets auth: inline json');
  } else {
    throw ApiError.internal(
      'CONFIG_MISSING',
      'Falta GOOGLE_SERVICE_ACCOUNT_FILE o GOOGLE_SERVICE_ACCOUNT_JSON',
    );
  }

  const raw = google.sheets({
    version: 'v4',
    auth: auth as unknown as Parameters<typeof google.sheets>[0] extends infer O
      ? O extends { auth?: infer A }
        ? A
        : never
      : never,
  });

  const cache = new Map<string, string[]>();

  async function readSheet(sheet: string): Promise<Record<string, unknown>[]> {
    const res = await raw.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: `${sheet}!A1:ZZ`,
    });
    const values = res.data.values ?? [];
    if (values.length === 0) return [];
    const headers = (values[0] ?? []).map(String);
    cache.set(sheet, headers);
    return values
      .slice(1)
      .filter((row) => row.some((v) => v !== ''))
      .map((row) => {
        const out: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          out[h] = row[i] ?? '';
        });
        return out;
      });
  }

  async function rows(sheet: string): Promise<Record<string, unknown>[]> {
    return readSheet(sheet);
  }

  async function findOne(
    sheet: string,
    predicate: (row: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown> | null> {
    const list = await readSheet(sheet);
    for (const row of list) if (predicate(row)) return row;
    return null;
  }

  async function append(sheet: string, record: Record<string, unknown>): Promise<void> {
    let headers = cache.get(sheet);
    if (!headers) {
      const meta = await raw.spreadsheets.values.get({
        spreadsheetId: ssId,
        range: `${sheet}!A1:1`,
      });
      headers = (meta.data.values?.[0] ?? []).map(String);
      cache.set(sheet, headers);
    }
    const row = headers.map((h) =>
      record[h] === undefined || record[h] === null ? '' : String(record[h]),
    );
    await raw.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: `${sheet}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  }

  async function updateWhere(
    sheet: string,
    matchColumn: string,
    matchValue: string | number,
    patch: Record<string, unknown>,
  ): Promise<boolean> {
    const list = await readSheet(sheet);
    const target = matchValue.toString();
    const rowIndex = list.findIndex((r) => String(r[matchColumn] ?? '') === target);
    if (rowIndex < 0) return false;
    const headers = cache.get(sheet) ?? Object.keys(list[rowIndex] ?? {});
    const startRow = rowIndex + 2; // header is row 1, data starts at row 2
    const row = headers.map((h) => {
      if (h in patch) {
        const v = patch[h];
        return v === undefined || v === null ? '' : String(v);
      }
      return String(list[rowIndex]?.[h] ?? '');
    });
    await raw.spreadsheets.values.update({
      spreadsheetId: ssId,
      range: `${sheet}!A${startRow}:${String.fromCharCode(64 + headers.length)}${startRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
    return true;
  }

  function close(): void {
    // googleapis uses undici/fetch under the hood; no explicit close required.
    // Method kept so call sites can be future-proof.
  }

  return { raw, spreadsheetId: ssId, rows, findOne, append, updateWhere, close };
}
