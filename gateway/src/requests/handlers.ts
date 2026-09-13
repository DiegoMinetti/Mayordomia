/**
 * Request handlers — read paths and approval/rejection mutations.
 *
 *   requests.list      auth, perm request.review
 *   requests.get       auth, perm request.review
 *   requests.approve   auth, perm request.approve.{area|general} (per scope)
 *   requests.reject    auth, perm request.approve.{area|general} (per scope)
 *
 * All mutations:
 *   - enforce optimistic concurrency via expectedVersion
 *   - record an audit entry
 *   - best-effort publish a notification (silently swallowed if missing)
 *
 * Mirrors apps-script/Requests.gs.
 */
import { ApiError } from '../errors.js';
import { enumValue, id as validateId, object, string } from '../validation.js';
import * as AuthService from '../auth/service.js';
import type { AuditService } from '../audit/service.js';
import type { SheetsClient } from '../sheets/client.js';
import type { DispatchContext } from '../router/index.js';
import {
  REQUEST_TYPES,
  REQUEST_STATUSES,
  REQUEST_KINDS,
  APPROVAL_SCOPES,
  type RequestStatus,
} from './types.js';
import {
  findRequest,
  listOrgRequests,
  listRequestApprovals,
  updateRequest,
  updateApproval,
  type RequestRow,
  type ApprovalRow,
} from './repository.js';

export interface RequestsHandlersDeps {
  sheets: SheetsClient;
  audit: AuditService;
  /** Optional. When absent, approval notifications are silently skipped. */
  notifications?: {
    publish(input: Record<string, unknown>, ctx: { auth?: { user: { id: string }; organizationId: string }; requestId?: string }): Promise<unknown>;
  };
}

function parseDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw ApiError.badRequest('VALIDATION_ERROR', `${label} inválido`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('VALIDATION_ERROR', `${label} inválido`);
  return d.toISOString();
}

function toIso(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

function toListItem(row: RequestRow, approvals: ApprovalRow[]) {
  const flags = computeFlags(approvals);
  return {
    id: row.id,
    organizationId: row.organizationId ?? '',
    siteId: row.siteId,
    type: row.type,
    kind: row.kind,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    description: row.description,
    requestedFor: row.requestedFor,
    source: row.source,
    status: row.status,
    eventStart: row.eventStart,
    eventEnd: row.eventEnd,
    urgencyReason: row.urgencyReason,
    lateReason: row.lateReason,
    currentArea: row.currentArea,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
    approvalSummary: summarizeApprovals(approvals),
    needsAreaApproval: flags.needsAreaApproval,
    needsGeneralApproval: flags.needsGeneralApproval,
  };
}

function summarizeApprovals(approvals: ApprovalRow[]) {
  if (!approvals.length) return { area: 'NONE', general: 'NONE' };
  const area = approvals.filter((a) => a.scope === 'AREA');
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  return { area: rollup(area), general: rollup(general) };
}

function rollup(list: ApprovalRow[]): 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (!list.length) return 'NONE';
  if (list.some((a) => a.status === 'REJECTED')) return 'REJECTED';
  if (list.every((a) => a.status === 'APPROVED')) return 'APPROVED';
  return 'PENDING';
}

function computeFlags(approvals: ApprovalRow[]) {
  const area = approvals.filter((a) => a.scope === 'AREA');
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  const needsArea = area.length > 0 && area.every((a) => a.status === 'PENDING');
  const needsGeneral = general.length > 0 && general.every((a) => a.status === 'PENDING');
  return { needsAreaApproval: needsArea, needsGeneralApproval: needsGeneral };
}

function computeRequestStatus(row: RequestRow, approvals: ApprovalRow[]): RequestStatus {
  if (!approvals.length) return row.status as RequestStatus;
  if (approvals.some((a) => a.status === 'REJECTED')) return 'REJECTED';
  if (approvals.every((a) => a.status === 'APPROVED')) return 'APPROVED';
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  if (general.length && general.every((a) => a.status === 'PENDING')) return 'PENDING_GENERAL_APPROVAL';
  return 'PENDING_AREA_APPROVAL';
}

function buildTimeline(row: RequestRow, approvals: ApprovalRow[]) {
  const events: Array<Record<string, unknown>> = [];
  events.push({ at: row.createdAt, kind: 'CREATED', actor: row.createdBy ?? '', label: 'Solicitud creada' });
  for (const a of approvals) {
    if (a.reviewedAt) {
      events.push({
        at: a.reviewedAt,
        kind: a.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        actor: a.reviewedBy ?? '',
        scope: a.scope,
        areaId: a.areaId,
        comment: a.comment,
        label: a.scope === 'AREA' ? 'Aprobación de área' : 'Aprobación general',
      });
    }
  }
  if (row.updatedAt && row.updatedAt !== row.createdAt) {
    events.push({ at: row.updatedAt, kind: 'STATUS_CHANGED', actor: row.updatedBy ?? '', label: 'Estado actualizado' });
  }
  events.sort((a, b) => String(a['at']).localeCompare(String(b['at'])));
  return events;
}

function pickApproval(approvals: ApprovalRow[], scope: 'AREA' | 'GENERAL', currentArea: string | undefined): ApprovalRow | null {
  const rows = approvals.filter((a) => a.scope === scope);
  if (scope !== 'AREA') return rows[0] ?? null;
  if (!currentArea) return rows[0] ?? null;
  const matched = rows.filter((a) => a.areaId === currentArea);
  return matched[0] ?? rows[0] ?? null;
}

async function publishApprovalNotification(
  deps: RequestsHandlersDeps,
  request: RequestRow,
  kind: 'REQUEST_APPROVED' | 'REQUEST_REJECTED',
  ctx: DispatchContext,
): Promise<void> {
  if (!deps.notifications) return;
  try {
    await deps.notifications.publish(
      {
        organizationId: ctx.auth?.organizationId ?? '',
        userId: null,
        kind,
        title: kind === 'REQUEST_APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada',
        body: String(request.description ?? request.requesterName ?? '').slice(0, 200),
        link: `/requests/${request.id}`,
        entityType: 'Request',
        entityId: request.id,
      },
      { auth: { user: { id: 'system' }, organizationId: ctx.auth?.organizationId ?? '' }, requestId: ctx.requestId },
    );
  } catch {
    // best-effort
  }
}

export function makeRequestsHandlers(deps: RequestsHandlersDeps) {
  async function list(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const filters = {
      status: payload['status'] ? enumValue(payload['status'], 'status', REQUEST_STATUSES) : null,
      type: payload['type'] ? enumValue(payload['type'], 'type', REQUEST_TYPES) : null,
      kind: payload['kind'] ? enumValue(payload['kind'], 'kind', REQUEST_KINDS) : null,
      siteId: payload['siteId'] ? validateId(payload['siteId'], 'siteId') : null,
      since: parseDate(payload['since'], 'since'),
      until: parseDate(payload['until'], 'until'),
    };
    const orgId = ctx.auth!.organizationId;
    let rows = await listOrgRequests(deps.sheets, orgId);
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.type) rows = rows.filter((r) => r.type === filters.type);
    if (filters.kind) rows = rows.filter((r) => r.kind === filters.kind);
    if (filters.siteId) rows = rows.filter((r) => r.siteId === filters.siteId);
    if (filters.since) {
      const sinceIso = filters.since;
      rows = rows.filter((r) => toIso(r.createdAt) >= sinceIso);
    }
    if (filters.until) {
      const untilIso = filters.until;
      rows = rows.filter((r) => toIso(r.createdAt) <= untilIso);
    }
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const approvalsByRequest = new Map<string, ApprovalRow[]>();
    for (const a of await listRequestApprovals(deps.sheets, orgId)) {
      const list = approvalsByRequest.get(a.requestId) ?? [];
      list.push(a);
      approvalsByRequest.set(a.requestId, list);
    }
    return {
      requests: rows.map((r) => toListItem(r, approvalsByRequest.get(r.id) ?? [])),
    };
  }

  async function get(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const orgId = ctx.auth!.organizationId;
    const row = await findRequest(deps.sheets, id, orgId);
    if (!row) throw ApiError.notFound('Solicitud');
    const approvals = await listRequestApprovals(deps.sheets, orgId, id);
    return {
      request: {
        ...toListItem(row, approvals),
        approvals,
        timeline: buildTimeline(row, approvals),
        flags: computeFlags(approvals),
      },
    };
  }

  function parseDecisionPayload(
    payload: Record<string, unknown>,
    ctx: DispatchContext,
    areaPermission: string,
    generalPermission: string,
  ) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const scope = enumValue(payload['scope'], 'scope', APPROVAL_SCOPES);
    const expectedVersion = Number(payload['expectedVersion']);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'expectedVersion debe ser un entero positivo');
    }
    const comment = payload['comment'] ? string(payload['comment'], 'comment', { max: 500 }).replace(/[<>]/g, '') : '';
    const required = scope === 'AREA' ? areaPermission : generalPermission;
    AuthService.requirePermission(ctx.auth!, required);
    return { id, scope, expectedVersion, comment };
  }

  async function approve(payload: Record<string, unknown>, ctx: DispatchContext) {
    const input = parseDecisionPayload(payload, ctx, 'request.approve.area', 'request.approve.general');
    const orgId = ctx.auth!.organizationId;
    const actorId = String(ctx.auth!.user['id']);
    const request = await findRequest(deps.sheets, input.id, orgId);
    if (!request) throw ApiError.notFound('Solicitud');
    if (
      request.status === 'APPROVED' ||
      request.status === 'REJECTED' ||
      request.status === 'CANCELLED' ||
      request.status === 'DELIVERED'
    ) {
      throw ApiError.conflict('REQUEST_LOCKED', 'La solicitud ya fue cerrada');
    }
    const approvals = await listRequestApprovals(deps.sheets, orgId, input.id);
    const approval = pickApproval(approvals, input.scope, request.currentArea);
    if (!approval) throw ApiError.notFound('Aprobación');
    await updateApproval(deps.sheets, orgId, input.id, input.scope, approval.areaId, 'APPROVED', actorId, input.comment);
    const fresh = await listRequestApprovals(deps.sheets, orgId, input.id);
    const nextStatus = computeRequestStatus(request, fresh);
    const updated = await updateRequest(deps.sheets, orgId, input.id, input.expectedVersion, { status: nextStatus }, actorId);
    await deps.audit.record({
      organizationId: orgId,
      actorId,
      actorType: 'USER',
      action: 'request.approve',
      entityType: 'Request',
      entityId: input.id,
      requestId: ctx.requestId,
      metadata: { scope: input.scope, areaId: approval.areaId ?? null, comment: input.comment },
    });
    await publishApprovalNotification(deps, request, 'REQUEST_APPROVED', ctx);
    return { id: input.id, status: nextStatus, version: updated.version };
  }

  async function reject(payload: Record<string, unknown>, ctx: DispatchContext) {
    const input = parseDecisionPayload(payload, ctx, 'request.approve.area', 'request.approve.general');
    const orgId = ctx.auth!.organizationId;
    const actorId = String(ctx.auth!.user['id']);
    const request = await findRequest(deps.sheets, input.id, orgId);
    if (!request) throw ApiError.notFound('Solicitud');
    const approvals = await listRequestApprovals(deps.sheets, orgId, input.id);
    const approval = pickApproval(approvals, input.scope, request.currentArea);
    if (!approval) throw ApiError.notFound('Aprobación');
    await updateApproval(deps.sheets, orgId, input.id, input.scope, approval.areaId, 'REJECTED', actorId, input.comment);
    const updated = await updateRequest(deps.sheets, orgId, input.id, input.expectedVersion, { status: 'REJECTED' }, actorId);
    await deps.audit.record({
      organizationId: orgId,
      actorId,
      actorType: 'USER',
      action: 'request.reject',
      entityType: 'Request',
      entityId: input.id,
      requestId: ctx.requestId,
      metadata: { scope: input.scope, areaId: approval.areaId ?? null, comment: input.comment },
    });
    await publishApprovalNotification(deps, request, 'REQUEST_REJECTED', ctx);
    return { id: input.id, status: 'REJECTED', version: updated.version };
  }

  return { list, get, approve, reject };
}

export type RequestsHandlers = ReturnType<typeof makeRequestsHandlers>;
