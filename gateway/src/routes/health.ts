/**
 * Health endpoint — port of apps-script/Health.gs.
 *
 * Returns the version, schema info, and the status of each provider (sheets,
 * sqlite, calendar, email). `push` always reports NOT_AVAILABLE because we
 * don't run a Web Push provider yet.
 */
import type { SheetsClient } from '../sheets/client.js';
import type { Config } from '../config.js';
import type { DispatchContext } from '../router/index.js';
import type { Db } from '../db/index.js';
import { listAppliedMigrations, probeDb } from '../db/index.js';
import { ApiException } from '../errors.js';

export const VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;

export interface HealthHandlersDeps {
  sheets: SheetsClient;
  config: Config;
  db?: Db;
}

export function makeHealthHandlers(deps: HealthHandlersDeps) {
  async function check(_payload: Record<string, unknown>, ctx: DispatchContext) {
    const sheets = await probeSheets(deps.sheets);
    const sqlite = probeSqlite(deps.db);
    return {
      version: VERSION,
      schemaVersion: SCHEMA_VERSION,
      expectedSchemaVersion: SCHEMA_VERSION,
      drive: {
        status: 'NOT_APPLICABLE',
        reason: 'Drive provider not needed in Node gateway (descriptor lives in spreadsheet)',
      },
      sheets,
      sqlite,
      calendar: deps.config.calendarId
        ? { status: 'NOT_PROBED', reason: 'Calendar integration not yet ported' }
        : { status: 'NOT_CONFIGURED' },
      email:
        deps.config.resendApiKey && deps.config.resendFrom
          ? { status: 'NOT_PROBED', reason: 'Resend integration not yet ported' }
          : { status: 'NOT_CONFIGURED' },
      push: { status: 'NOT_AVAILABLE', reason: 'Proveedor no configurado' },
      checkedAt: new Date().toISOString(),
      requestId: ctx.requestId,
    };
  }

  return { check };
}

async function probeSheets(
  sheets: SheetsClient,
): Promise<{ status: 'OK' | 'ERROR'; detail?: string }> {
  try {
    await sheets.rows('Organizations');
    return { status: 'OK' };
  } catch (error) {
    if (error instanceof ApiException) {
      return { status: 'ERROR', detail: error.message };
    }
    return { status: 'ERROR' };
  }
}

function probeSqlite(db: Db | undefined): {
  status: 'OK' | 'ERROR' | 'NOT_CONFIGURED';
  detail?: string;
  tables?: number;
  migrationsApplied?: number;
} {
  if (!db) return { status: 'NOT_CONFIGURED' };
  const probe = probeDb(db);
  if (!probe.ok) return { status: 'ERROR', detail: probe.error };
  const tables = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_mayordomia_migrations'",
      )
      .get() as { n: number }
  ).n;
  const applied = listAppliedMigrations(db);
  return { status: 'OK', tables, migrationsApplied: applied.length };
}

export type HealthHandlers = ReturnType<typeof makeHealthHandlers>;
