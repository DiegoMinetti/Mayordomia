/**
 * Stable response envelope. Mirrors apps-script/Response.gs so the frontend
 * doesn't need to change between the Apps Script and Node gateways.
 *
 *   { ok: true,  data: T | null,    error: null,                       meta: { requestId } }
 *   { ok: false, data: null,        error: { code, message, details }, meta: { requestId } }
 */

export interface Meta {
  requestId: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

export type Envelope<T> =
  | { ok: true; data: T; error: null; meta: Meta }
  | { ok: false; data: null; error: ApiErrorBody; meta: Meta };

export function ok<T>(data: T, requestId: string): Envelope<T> {
  return { ok: true, data: (data ?? null) as T, error: null, meta: { requestId } };
}

export function fail(
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
  status?: number,
): Envelope<never> {
  const body: ApiErrorBody = { code, message };
  if (details !== undefined) body.details = details;
  if (status !== undefined) body.status = status;
  return { ok: false, data: null, error: body, meta: { requestId } };
}
