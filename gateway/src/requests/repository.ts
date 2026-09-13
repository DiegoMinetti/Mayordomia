/**
 * Repository helpers for the Requests module. Wraps Sheets reads/writes
 * with org-scoped predicates so callers don't accidentally cross tenants.
 */
import { randomUUID } from 'node:crypto';
import { ApiError } from '../errors.js';
import type { SheetsClient } from '../sheets/client.js';
import type { ApprovalScope, ApprovalStatus } from './types.js';

export interface RequestRow {
  id: string;
  organizationId: string;
  siteId?: string;
  type: string;
  kind?: string;
  requesterName: string;
  requesterEmail?: string;
  description: string;
  requestedFor?: string;
  source: string;
  status: string;
  eventStart?: string;
  eventEnd?: string;
  urgencyReason?: string;
  lateReason?: string;
  currentArea?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  version: number;
}

export interface ApprovalRow {
  id: string;
  organizationId: string;
  requestId: string;
  scope: string;
  areaId?: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  comment?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export async function findRequest(
  sheets: SheetsClient,
  id: string,
  organizationId: string,
): Promise<RequestRow | null> {
  const row = await sheets.findOne('Requests', (r) => {
    return String(r['id']) === id && String(r['organizationId']) === organizationId;
  });
  return row ? (row as unknown as RequestRow) : null;
}

export async function listOrgRequests(
  sheets: SheetsClient,
  organizationId: string,
): Promise<RequestRow[]> {
  const rows = await sheets.rows('Requests');
  return rows
    .filter((r) => String(r['organizationId']) === organizationId)
    .map((r) => r as unknown as RequestRow);
}

export async function listRequestApprovals(
  sheets: SheetsClient,
  organizationId: string,
  requestId?: string,
): Promise<ApprovalRow[]> {
  const rows = await sheets.rows('RequestApprovals');
  return rows
    .filter((a) => {
      const sameOrg = String(a['organizationId']) === organizationId;
      const sameRequest = requestId === undefined || String(a['requestId']) === requestId;
      return sameOrg && sameRequest;
    })
    .map((a) => a as unknown as ApprovalRow);
}

export async function appendRequest(
  sheets: SheetsClient,
  record: Record<string, unknown>,
): Promise<void> {
  await sheets.append('Requests', record);
}

/**
 * Optimistic-concurrency update. Reads the row by id, asserts version,
 * patches fields, writes back. Returns the patched row.
 */
export async function updateRequest(
  sheets: SheetsClient,
  organizationId: string,
  id: string,
  expectedVersion: number,
  patch: Record<string, unknown>,
  updatedBy: string,
): Promise<RequestRow> {
  const all = await listOrgRequests(sheets, organizationId);
  const row = all.find((r) => r.id === id);
  if (!row) throw ApiError.notFound('Solicitud');
  if (row.version !== expectedVersion) {
    throw ApiError.conflict('VERSION_MISMATCH', 'La solicitud fue modificada por otro usuario', {
      expectedVersion,
      actualVersion: row.version,
    });
  }
  const next = { ...row, ...patch, version: row.version + 1, updatedAt: new Date().toISOString(), updatedBy };
  await sheets.updateWhere('Requests', 'id', id, next);
  return next as RequestRow;
}

export async function updateApproval(
  sheets: SheetsClient,
  organizationId: string,
  requestId: string,
  scope: ApprovalScope,
  areaId: string | undefined,
  status: ApprovalStatus,
  reviewedBy: string,
  comment: string,
): Promise<ApprovalRow> {
  const all = await listRequestApprovals(sheets, organizationId, requestId);
  const candidates = all.filter((a) => a.scope === scope);
  const matched =
    scope === 'AREA' && areaId
      ? candidates.find((a) => a.areaId === areaId) ?? candidates[0]
      : candidates[0];
  if (!matched) throw ApiError.notFound('Aprobación');
  if (matched.status === 'APPROVED' || matched.status === 'REJECTED') {
    throw ApiError.conflict('APPROVAL_LOCKED', 'La aprobación ya fue registrada');
  }
  const now = new Date().toISOString();
  const next = {
    ...matched,
    status,
    reviewedBy,
    reviewedAt: now,
    comment,
    updatedAt: now,
    updatedBy: reviewedBy,
    version: matched.version + 1,
  };
  await sheets.updateWhere('RequestApprovals', 'id', matched.id, next);
  return next as ApprovalRow;
}

export function newRequestId(): string {
  return randomUUID();
}
