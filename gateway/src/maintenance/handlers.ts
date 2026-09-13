/**
 * Maintenance read endpoints. PR 4 covers list/get only.
 * Mutations (create, update) come in PR 5.
 */
import { ApiError } from '../errors.js';
import { enumValue, id as validateId, object } from '../validation.js';
import type { SheetsClient } from '../sheets/client.js';
import type { DispatchContext } from '../router/index.js';

const KINDS = ['CORRECTIVE', 'PREVENTIVE', 'INSPECTION'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const;

export interface MaintenanceHandlersDeps {
  sheets: SheetsClient;
}

function toMaintenance(r: Record<string, unknown>) {
  const out: Record<string, unknown> = {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    reportedBy: String(r['reportedBy'] ?? ''),
    reportedAt: String(r['reportedAt'] ?? ''),
    kind: String(r['kind'] ?? 'CORRECTIVE'),
    severity: String(r['severity'] ?? 'MEDIUM'),
    status: String(r['status'] ?? 'OPEN'),
    description: String(r['description'] ?? ''),
    createdAt: String(r['createdAt'] ?? ''),
    version: Number(r['version'] ?? 1),
  };
  for (const opt of ['siteId', 'resourceId', 'resolution', 'supplierId', 'sourceDeliveryItemId', 'startedAt', 'resolvedAt', 'updatedAt', 'createdBy', 'updatedBy']) {
    const v = r[opt];
    if (v !== undefined && v !== '') out[opt] = String(v);
  }
  if (typeof r['cost'] === 'number' && Number.isFinite(r['cost'])) out['cost'] = r['cost'];
  return out;
}

function toMaintenanceUpdate(r: Record<string, unknown>) {
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    maintenanceId: String(r['maintenanceId'] ?? ''),
    authorId: String(r['authorId'] ?? ''),
    at: String(r['at'] ?? ''),
    kind: String(r['kind'] ?? 'NOTE'),
    text: String(r['text'] ?? ''),
    createdAt: String(r['createdAt'] ?? ''),
    version: Number(r['version'] ?? 1),
  };
}

export function makeMaintenanceHandlers(deps: MaintenanceHandlersDeps) {
  async function list(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const orgId = ctx.auth!.organizationId;
    const filters = {
      status: payload['status'] ? enumValue(payload['status'], 'status', STATUSES) : null,
      kind: payload['kind'] ? enumValue(payload['kind'], 'kind', KINDS) : null,
      severity: payload['severity'] ? enumValue(payload['severity'], 'severity', SEVERITIES) : null,
      resourceId: payload['resourceId'] ? validateId(payload['resourceId'], 'resourceId') : null,
      siteId: payload['siteId'] ? validateId(payload['siteId'], 'siteId') : null,
    };
    let rows = (await deps.sheets.rows('Maintenance')).filter((r) => String(r['organizationId']) === orgId);
    if (filters.status) rows = rows.filter((r) => String(r['status']) === filters.status);
    if (filters.kind) rows = rows.filter((r) => String(r['kind']) === filters.kind);
    if (filters.severity) rows = rows.filter((r) => String(r['severity']) === filters.severity);
    if (filters.resourceId) rows = rows.filter((r) => String(r['resourceId']) === filters.resourceId);
    if (filters.siteId) rows = rows.filter((r) => String(r['siteId']) === filters.siteId);
    rows.sort((a, b) => String(b['reportedAt'] ?? '').localeCompare(String(a['reportedAt'] ?? '')));
    return { maintenance: rows.map(toMaintenance) };
  }

  async function get(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const orgId = ctx.auth!.organizationId;
    const row = await deps.sheets.findOne('Maintenance', (r) => {
      return String(r['id']) === id && String(r['organizationId']) === orgId;
    });
    if (!row) throw ApiError.notFound('Mantenimiento');
    const updates = (await deps.sheets.rows('MaintenanceUpdates'))
      .filter((u) => String(u['organizationId']) === orgId && String(u['maintenanceId']) === id)
      .sort((a, b) => String(a['at'] ?? '').localeCompare(String(b['at'] ?? '')))
      .map(toMaintenanceUpdate);
    return { maintenance: toMaintenance(row), updates };
  }

  return { list, get };
}

export type MaintenanceHandlers = ReturnType<typeof makeMaintenanceHandlers>;
