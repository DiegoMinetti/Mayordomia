/**
 * GatewayClient — thin HTTP wrapper for the Apps Script Web App.
 *
 * Responsibilities:
 *   - Serialize the request envelope (action, organizationId, auth, payload).
 *   - Inject the current access token via the auth provider callback.
 *   - Normalize the response into a typed result (ok | error).
 *   - Never throw on business errors; throw only on programmer errors
 *     (NOT_CONFIGURED, missing token, etc.).
 *
 * The mock mode short-circuits the network and returns deterministic data
 * derived from a counter, so the rest of the app keeps working when the
 * gateway isn't deployed yet.
 */

import type { GatewayResponse } from './types';

export interface GatewayClientDeps {
  appsScriptUrl: string;
  getAccessToken: () => Promise<string>;
  /** Opt-in mock mode. Falls back to true if the URL is missing. */
  mock?: boolean;
  /** Optional fetch override (tests). */
  fetchImpl?: typeof fetch;
}

export class GatewayClient {
  constructor(private readonly deps: GatewayClientDeps) {}

  async call<T>(
    action: string,
    organizationId: string,
    payload: Record<string, unknown> = {},
  ): Promise<GatewayResponse<T>> {
    if (this.deps.mock ?? !this.deps.appsScriptUrl) {
      return mockDispatch<T>(action, organizationId, payload);
    }
    let token: string;
    try {
      token = await this.deps.getAccessToken();
    } catch {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'No hay sesión válida' } };
    }
    const fetchImpl = this.deps.fetchImpl ?? fetch;
    let raw: Response;
    try {
      raw = await fetchImpl(this.deps.appsScriptUrl, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, organizationId, auth: { accessToken: token }, payload }),
      });
    } catch {
      return { ok: false, error: { code: 'NETWORK', message: 'No se pudo contactar al gateway' } };
    }
    let env: unknown;
    try {
      env = await raw.json();
    } catch {
      return { ok: false, error: { code: 'NETWORK', message: 'Respuesta no es JSON válido' } };
    }
    if (!env || typeof env !== 'object' || !('ok' in env)) {
      return { ok: false, error: { code: 'NETWORK', message: 'Envelope inválido' } };
    }
    return env as GatewayResponse<T>;
  }
}

let mockCounter = 0;
function nextId(): string {
  mockCounter += 1;
  return `mock-${mockCounter.toString().padStart(4, '0')}`;
}

export interface RequestMockSnapshot {
  requests: unknown[];
  approvals: unknown[];
}
const mockRequestSnapshots = new Map<string, RequestMockSnapshot>();

function ensureRequestMock(organizationId: string): RequestMockSnapshot {
  const cached = mockRequestSnapshots.get(organizationId);
  if (cached) return cached;
  const requests = [
    {
      id: 'mock-req-0001',
      organizationId,
      siteId: 'mock-site-0001',
      type: 'AUDIO',
      kind: 'SERVICE',
      requesterName: 'Carla Méndez',
      requesterEmail: 'carla@example.com',
      description: 'Sonido para reunión especial del sábado.',
      requestedFor: 'Reunión especial',
      source: 'PUBLIC_QR',
      status: 'PENDING_AREA_APPROVAL',
      eventStart: '2026-09-12T19:00:00Z',
      eventEnd: '2026-09-12T21:00:00Z',
      currentArea: 'mock-area-0001',
      createdAt: '2026-08-29T15:24:00Z',
      updatedAt: '2026-08-29T15:24:00Z',
      version: 1,
    },
    {
      id: 'mock-req-0002',
      organizationId,
      siteId: 'mock-site-0001',
      type: 'RESOURCE',
      kind: 'PHYSICAL',
      requesterName: 'Luis Pérez',
      requesterEmail: 'luis@example.com',
      description: '20 sillas adicionales para el salón principal.',
      requestedFor: 'Reunión de jóvenes',
      source: 'INTERNAL',
      status: 'PENDING_GENERAL_APPROVAL',
      eventStart: '2026-09-15T18:00:00Z',
      eventEnd: '2026-09-15T22:00:00Z',
      currentArea: 'mock-area-0002',
      createdAt: '2026-08-28T11:02:00Z',
      updatedAt: '2026-08-29T09:10:00Z',
      version: 2,
    },
    {
      id: 'mock-req-0003',
      organizationId,
      siteId: 'mock-site-0001',
      type: 'LOCATION',
      kind: 'PHYSICAL',
      requesterName: 'Ana Suárez',
      requesterEmail: 'ana@example.com',
      description: 'Reserva del salón chico para ensayo de coro.',
      requestedFor: 'Ensayo semanal',
      source: 'INTERNAL',
      status: 'APPROVED',
      eventStart: '2026-09-05T20:00:00Z',
      eventEnd: '2026-09-05T22:00:00Z',
      createdAt: '2026-08-25T09:00:00Z',
      updatedAt: '2026-08-27T14:32:00Z',
      version: 3,
    },
    {
      id: 'mock-req-0004',
      organizationId,
      siteId: 'mock-site-0002',
      type: 'MULTIMEDIA',
      kind: 'SERVICE',
      requesterName: 'Pedro Ramírez',
      requesterEmail: 'pedro@example.com',
      description: 'Proyección y slides para capacitación.',
      requestedFor: 'Capacitación mensual',
      source: 'PUBLIC_QR',
      status: 'PENDING',
      eventStart: '2026-09-02T18:00:00Z',
      eventEnd: '2026-09-02T20:00:00Z',
      urgencyReason: 'Confirmación tardía del expositor',
      createdAt: '2026-08-30T08:00:00Z',
      version: 1,
    },
    {
      id: 'mock-req-0005',
      organizationId,
      siteId: 'mock-site-0001',
      type: 'MAINTENANCE',
      kind: 'MAINTENANCE',
      requesterName: 'Sofía Castro',
      requesterEmail: 'sofia@example.com',
      description: 'Aire acondicionado del salón principal hace ruido.',
      source: 'INTERNAL',
      status: 'REJECTED',
      createdAt: '2026-08-20T10:00:00Z',
      updatedAt: '2026-08-21T12:00:00Z',
      version: 2,
    },
    {
      id: 'mock-req-0006',
      organizationId,
      siteId: 'mock-site-0001',
      type: 'RESOURCE',
      kind: 'PHYSICAL',
      requesterName: 'Diego Minetti',
      requesterEmail: 'diego@example.com',
      description: 'Notebook para capacitación de voluntarios.',
      requestedFor: 'Capacitación',
      source: 'INTERNAL',
      status: 'DELIVERED',
      eventStart: '2026-08-30T13:00:00Z',
      eventEnd: '2026-08-30T15:00:00Z',
      createdAt: '2026-08-29T17:00:00Z',
      updatedAt: '2026-08-30T12:00:00Z',
      version: 4,
    },
    {
      id: 'mock-req-0007',
      organizationId,
      siteId: 'mock-site-0002',
      type: 'OTHER',
      kind: 'SERVICE',
      requesterName: 'Mariana López',
      requesterEmail: 'mariana@example.com',
      description: 'Pedido de bibliografía para grupo pequeño.',
      requestedFor: 'Grupo de estudio',
      source: 'INTERNAL',
      status: 'CANCELLED',
      createdAt: '2026-08-15T09:00:00Z',
      updatedAt: '2026-08-18T10:00:00Z',
      version: 1,
    },
  ];
  const approvals = [
    {
      id: 'mock-app-0001',
      organizationId,
      requestId: 'mock-req-0001',
      scope: 'AREA',
      areaId: 'mock-area-0001',
      status: 'PENDING',
      createdAt: '2026-08-29T15:24:00Z',
      createdBy: 'public',
      updatedAt: '2026-08-29T15:24:00Z',
      updatedBy: 'public',
      version: 1,
    },
    {
      id: 'mock-app-0002',
      organizationId,
      requestId: 'mock-req-0002',
      scope: 'AREA',
      areaId: 'mock-area-0002',
      status: 'APPROVED',
      reviewedBy: 'mock-user-0001',
      reviewedAt: '2026-08-29T08:00:00Z',
      createdAt: '2026-08-28T11:02:00Z',
      createdBy: 'mock-user-0003',
      updatedAt: '2026-08-29T08:00:00Z',
      updatedBy: 'mock-user-0001',
      version: 2,
    },
    {
      id: 'mock-app-0003',
      organizationId,
      requestId: 'mock-req-0002',
      scope: 'GENERAL',
      status: 'PENDING',
      createdAt: '2026-08-28T11:02:00Z',
      createdBy: 'mock-user-0003',
      updatedAt: '2026-08-28T11:02:00Z',
      updatedBy: 'mock-user-0003',
      version: 1,
    },
    {
      id: 'mock-app-0004',
      organizationId,
      requestId: 'mock-req-0003',
      scope: 'AREA',
      areaId: 'mock-area-0002',
      status: 'APPROVED',
      reviewedBy: 'mock-user-0001',
      reviewedAt: '2026-08-26T10:00:00Z',
      createdAt: '2026-08-25T09:00:00Z',
      createdBy: 'mock-user-0003',
      updatedAt: '2026-08-26T10:00:00Z',
      updatedBy: 'mock-user-0001',
      version: 2,
    },
    {
      id: 'mock-app-0005',
      organizationId,
      requestId: 'mock-req-0003',
      scope: 'GENERAL',
      status: 'APPROVED',
      reviewedBy: 'mock-user-0002',
      reviewedAt: '2026-08-27T14:32:00Z',
      createdAt: '2026-08-25T09:00:00Z',
      createdBy: 'mock-user-0003',
      updatedAt: '2026-08-27T14:32:00Z',
      updatedBy: 'mock-user-0002',
      version: 2,
    },
    {
      id: 'mock-app-0006',
      organizationId,
      requestId: 'mock-req-0005',
      scope: 'GENERAL',
      status: 'REJECTED',
      reviewedBy: 'mock-user-0002',
      reviewedAt: '2026-08-21T12:00:00Z',
      comment: 'Encargar a proveedor externo.',
      createdAt: '2026-08-20T10:00:00Z',
      createdBy: 'mock-user-0003',
      updatedAt: '2026-08-21T12:00:00Z',
      updatedBy: 'mock-user-0002',
      version: 2,
    },
    {
      id: 'mock-app-0007',
      organizationId,
      requestId: 'mock-req-0006',
      scope: 'AREA',
      areaId: 'mock-area-0001',
      status: 'APPROVED',
      reviewedBy: 'mock-user-0001',
      reviewedAt: '2026-08-29T18:00:00Z',
      createdAt: '2026-08-29T17:00:00Z',
      createdBy: 'mock-user-0003',
      updatedAt: '2026-08-29T18:00:00Z',
      updatedBy: 'mock-user-0001',
      version: 2,
    },
    {
      id: 'mock-app-0008',
      organizationId,
      requestId: 'mock-req-0006',
      scope: 'GENERAL',
      status: 'APPROVED',
      reviewedBy: 'mock-user-0002',
      reviewedAt: '2026-08-30T08:00:00Z',
      createdAt: '2026-08-29T17:00:00Z',
      createdBy: 'mock-user-0003',
      updatedAt: '2026-08-30T08:00:00Z',
      updatedBy: 'mock-user-0002',
      version: 2,
    },
  ];
  const snapshot: RequestMockSnapshot = {
    requests: requests as unknown[],
    approvals: approvals as unknown[],
  };
  mockRequestSnapshots.set(organizationId, snapshot);
  return snapshot;
}

function rollup(list: { status: string }[]): 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (!list.length) return 'NONE';
  if (list.some((a) => a.status === 'REJECTED')) return 'REJECTED';
  if (list.every((a) => a.status === 'APPROVED')) return 'APPROVED';
  return 'PENDING';
}

function rollupApprovals(approvals: { scope: string; status: string }[]): {
  area: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  general: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
} {
  const area = approvals.filter((a) => a.scope === 'AREA');
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  return { area: rollup(area), general: rollup(general) };
}

function computeRequestStatus(
  request: { status: string },
  approvals: { status: string; scope: string }[],
): string {
  if (!approvals.length) return request.status;
  if (approvals.some((a) => a.status === 'REJECTED')) return 'REJECTED';
  if (approvals.every((a) => a.status === 'APPROVED')) return 'APPROVED';
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  if (general.length && general.every((a) => a.status === 'PENDING')) {
    return 'PENDING_GENERAL_APPROVAL';
  }
  return 'PENDING_AREA_APPROVAL';
}

function buildTimeline(
  request: { createdAt: string; updatedAt?: string; organizationId: string },
  approvals: {
    reviewedAt?: string;
    reviewedBy?: string;
    scope: string;
    areaId?: string;
    comment?: string;
    status: string;
  }[],
): {
  at: string;
  kind: string;
  actor: string;
  label: string;
  scope?: string;
  areaId?: string;
  comment?: string;
}[] {
  const events: ReturnType<typeof buildTimeline> = [];
  events.push({
    at: request.createdAt,
    kind: 'CREATED',
    actor: request.organizationId,
    label: 'Solicitud creada',
  });
  for (const a of approvals) {
    if (a.reviewedAt) {
      events.push({
        at: a.reviewedAt,
        kind: a.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        actor: a.reviewedBy || '',
        label: a.scope === 'AREA' ? 'Aprobación de área' : 'Aprobación general',
        scope: a.scope,
        areaId: a.areaId,
        comment: a.comment,
      });
    }
  }
  if (request.updatedAt && request.updatedAt !== request.createdAt) {
    events.push({
      at: request.updatedAt,
      kind: 'STATUS_CHANGED',
      actor: '',
      label: 'Estado actualizado',
    });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  return events;
}

function enrichListItem(
  row: Record<string, unknown>,
  approvals: Record<string, unknown>[],
): Record<string, unknown> {
  const summary = rollupApprovals(approvals as unknown as { scope: string; status: string }[]);
  const area = approvals.filter((a) => (a as { scope: string }).scope === 'AREA');
  const general = approvals.filter((a) => (a as { scope: string }).scope === 'GENERAL');
  return {
    ...row,
    status: computeRequestStatus(
      row as { status: string },
      approvals as unknown as { status: string; scope: string }[],
    ),
    approvalSummary: summary,
    needsAreaApproval:
      area.length > 0 && area.every((a) => (a as { status: string }).status === 'PENDING'),
    needsGeneralApproval:
      general.length > 0 && general.every((a) => (a as { status: string }).status === 'PENDING'),
  };
}

function mockDispatch<T>(
  action: string,
  organizationId: string,
  payload: Record<string, unknown> = {},
): GatewayResponse<T> {
  switch (action) {
    case 'catalog.organization':
    case 'catalog.listOrganizations': {
      return {
        ok: true,
        data: {
          organization: {
            id: organizationId,
            name: 'Congregación Demo',
            timezone: 'America/Argentina/Buenos_Aires',
            active: true,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          organizations: [
            {
              id: organizationId,
              name: 'Congregación Demo',
              timezone: 'America/Argentina/Buenos_Aires',
              active: true,
              version: 1,
            },
          ],
        } as T,
      };
    }
    case 'catalog.listSites': {
      return {
        ok: true,
        data: {
          sites: [
            {
              id: nextId(),
              organizationId,
              name: 'Sede Centro',
              address: 'Av. Demo 123',
              active: true,
              version: 1,
            },
            {
              id: nextId(),
              organizationId,
              name: 'Sede Norte',
              address: 'Calle Norte 456',
              active: true,
              version: 1,
            },
          ],
        } as T,
      };
    }
    case 'catalog.listUsers': {
      return {
        ok: true,
        data: {
          users: [
            {
              id: nextId(),
              organizationId,
              email: 'admin@demo.com',
              name: 'Admin Demo',
              status: 'ACTIVE',
              version: 1,
            },
            {
              id: nextId(),
              organizationId,
              email: 'op@demo.com',
              name: 'Operador Demo',
              status: 'ACTIVE',
              version: 1,
            },
          ],
        } as T,
      };
    }
    case 'catalog.listRoles': {
      return {
        ok: true,
        data: {
          roles: [
            { id: nextId(), organizationId, name: 'SUPER_ADMIN', permissionIds: ['*'], version: 1 },
            {
              id: nextId(),
              organizationId,
              name: 'OPERATOR',
              permissionIds: ['request.view', 'delivery.manage'],
              version: 1,
            },
          ],
        } as T,
      };
    }
    case 'requests.list': {
      const filters = payload as {
        status?: string;
        type?: string;
        siteId?: string;
        since?: string;
        until?: string;
      };
      const snapshot = ensureRequestMock(organizationId);
      let rows = [...snapshot.requests] as Array<Record<string, unknown>>;
      if (filters.status) rows = rows.filter((r) => r['status'] === filters.status);
      if (filters.type) rows = rows.filter((r) => r['type'] === filters.type);
      if (filters.siteId) rows = rows.filter((r) => r['siteId'] === filters.siteId);
      if (filters.since) rows = rows.filter((r) => String(r['createdAt']) >= filters.since!);
      if (filters.until) rows = rows.filter((r) => String(r['createdAt']) <= filters.until!);
      rows.sort((a, b) => String(b['createdAt']).localeCompare(String(a['createdAt'])));
      const approvalsByRequest = new Map<string, Array<Record<string, unknown>>>();
      for (const a of snapshot.approvals as Array<Record<string, unknown>>) {
        const k = String(a['requestId']);
        const list = approvalsByRequest.get(k) || [];
        list.push(a);
        approvalsByRequest.set(k, list);
      }
      const enriched = rows.map((r) =>
        enrichListItem(r, approvalsByRequest.get(String(r['id'])) || []),
      );
      return { ok: true, data: { requests: enriched } as T };
    }
    case 'requests.get': {
      const id = String((payload as { id?: string }).id || '');
      const snapshot = ensureRequestMock(organizationId);
      const row = (snapshot.requests as Array<Record<string, unknown>>).find((r) => r['id'] === id);
      if (!row) return { ok: false, error: { code: 'NOT_FOUND', message: 'Solicitud' } };
      const approvals = (snapshot.approvals as Array<Record<string, unknown>>).filter(
        (a) => a['requestId'] === id,
      );
      const list = enrichListItem(row, approvals);
      return {
        ok: true,
        data: {
          request: {
            ...list,
            approvals: [...approvals],
            timeline: buildTimeline(
              row as unknown as { createdAt: string; updatedAt?: string; organizationId: string },
              approvals as unknown as {
                reviewedAt?: string;
                reviewedBy?: string;
                scope: string;
                areaId?: string;
                comment?: string;
                status: string;
              }[],
            ),
            flags: {
              needsAreaApproval:
                approvals.filter((a) => (a as { scope: string }).scope === 'AREA').length > 0 &&
                approvals
                  .filter((a) => (a as { scope: string }).scope === 'AREA')
                  .every((a) => (a as { status: string }).status === 'PENDING'),
              needsGeneralApproval:
                approvals.filter((a) => (a as { scope: string }).scope === 'GENERAL').length > 0 &&
                approvals
                  .filter((a) => (a as { scope: string }).scope === 'GENERAL')
                  .every((a) => (a as { status: string }).status === 'PENDING'),
            },
          },
        } as T,
      };
    }
    case 'requests.approve':
    case 'requests.reject': {
      const body = payload as {
        id?: string;
        scope?: string;
        expectedVersion?: number;
        comment?: string;
      };
      if (!body.id || !body.scope || !body.expectedVersion) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Faltan campos' } };
      }
      const snapshot = ensureRequestMock(organizationId);
      const row = (snapshot.requests as Array<Record<string, unknown>>).find(
        (r) => r['id'] === body.id,
      );
      if (!row) return { ok: false, error: { code: 'NOT_FOUND', message: 'Solicitud' } };
      if (Number(row['version']) !== body.expectedVersion) {
        return {
          ok: false,
          error: {
            code: 'VERSION_MISMATCH',
            message: 'La solicitud fue modificada por otro usuario',
          },
        };
      }
      const approvals = (snapshot.approvals as Array<Record<string, unknown>>).filter(
        (a) => a['requestId'] === body.id && a['scope'] === body.scope,
      );
      const target = approvals[0];
      if (!target) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Aprobación' } };
      }
      if (target['status'] !== 'PENDING') {
        return {
          ok: false,
          error: { code: 'APPROVAL_LOCKED', message: 'La aprobación ya fue registrada' },
        };
      }
      const newStatus = action === 'requests.approve' ? 'APPROVED' : 'REJECTED';
      const now = new Date().toISOString();
      target['status'] = newStatus;
      target['reviewedBy'] = 'mock-user-current';
      target['reviewedAt'] = now;
      target['comment'] = body.comment || '';
      target['updatedAt'] = now;
      target['updatedBy'] = 'mock-user-current';
      target['version'] = Number(target['version'] || 1) + 1;
      const allApprovals = (snapshot.approvals as Array<Record<string, unknown>>).filter(
        (a) => a['requestId'] === body.id,
      );
      const nextStatus = computeRequestStatus(
        row as { status: string },
        allApprovals as unknown as { status: string; scope: string }[],
      );
      row['status'] = nextStatus;
      row['updatedAt'] = now;
      row['version'] = Number(row['version'] || 1) + 1;
      return {
        ok: true,
        data: { id: body.id, status: nextStatus, version: Number(row['version']) } as T,
      };
    }
    default:
      return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Mock no soporta ${action}` } };
  }
}
