/**
 * Health endpoint — port of apps-script/Health.gs.
 *
 * Returns the version, schema info, and the status of each provider (sheets,
 * calendar, email). `push` always reports NOT_AVAILABLE because we don't run
 * a Web Push provider yet.
 */
import type { SheetsClient } from '../sheets/client.js';
import type { Config } from '../config.js';
import type { DispatchContext } from '../router/index.js';
import { ApiError } from '../errors.js';

export const VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;

export interface HealthHandlersDeps {
  sheets: SheetsClient;
  config: Config;
}

export function makeHealthHandlers(deps: HealthHandlersDeps) {
  async function check(_payload: Record<string, unknown>, ctx: DispatchContext) {
    const sheets = await probeSheets(deps.sheets);
    return {
      version: VERSION,
      schemaVersion: SCHEMA_VERSION,
      expectedSchemaVersion: SCHEMA_VERSION,
      drive: { status: 'NOT_APPLICABLE', reason: 'Drive provider not needed in Node gateway (descriptor lives in spreadsheet)' },
      sheets,
      calendar: deps.config.calendarId
        ? { status: 'NOT_PROBED', reason: 'Calendar integration not yet ported' }
        : { status: 'NOT_CONFIGURED' },
      email: deps.config.resendApiKey && deps.config.resendFrom
        ? { status: 'NOT_PROBED', reason: 'Resend integration not yet ported' }
        : { status: 'NOT_CONFIGURED' },
      push: { status: 'NOT_AVAILABLE', reason: 'Proveedor no configurado' },
      checkedAt: new Date().toISOString(),
      requestId: ctx.requestId,
    };
  }

  return { check };
}

async function probeSheets(sheets: SheetsClient): Promise<{ status: 'OK' | 'ERROR'; detail?: string }> {
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

import { ApiException } from '../errors.js';

export type HealthHandlers = ReturnType<typeof makeHealthHandlers>;
