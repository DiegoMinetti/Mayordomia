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

/**
 * Deterministic seed used to build mock events with stable timestamps relative
 * to the current run. The day offsets are pinned so tests don't flake.
 */
const MOCK_EVENT_SEED = '2026-09-14T00:00:00.000Z';
function mockBaseTs(): number {
  return new Date(MOCK_EVENT_SEED).getTime();
}
function mockEventAt(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(mockBaseTs() + dayOffset * 86_400_000);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}
function buildMockEvents(organizationId: string) {
  return [
    {
      id: nextId(),
      organizationId,
      siteId: 'site-centro',
      name: 'Culto principal',
      description: 'Servicio dominical con presencia completa.',
      kind: 'SERVICE',
      startAt: mockEventAt(0, 22, 0),
      endAt: mockEventAt(0, 23, 30),
      allDay: false,
      status: 'PUBLISHED',
      createdAt: mockEventAt(-7, 12),
      createdBy: 'u-admin',
      updatedAt: mockEventAt(-1, 12),
      updatedBy: 'u-admin',
      version: 2,
    },
    {
      id: nextId(),
      organizationId,
      siteId: 'site-centro',
      name: 'Ensayo de alabanza',
      description: 'Ensayo general de la banda.',
      kind: 'REHEARSAL',
      startAt: mockEventAt(1, 23, 0),
      endAt: mockEventAt(1, 24, 0),
      allDay: false,
      status: 'PUBLISHED',
      createdAt: mockEventAt(-5, 12),
      createdBy: 'u-admin',
      updatedAt: mockEventAt(-1, 12),
      updatedBy: 'u-admin',
      version: 1,
    },
    {
      id: nextId(),
      organizationId,
      siteId: 'site-norte',
      name: 'Escuela dominical',
      description: 'Clase para todas las edades.',
      kind: 'CLASS',
      startAt: mockEventAt(0, 13, 0),
      endAt: mockEventAt(0, 14, 30),
      allDay: false,
      status: 'PUBLISHED',
      createdAt: mockEventAt(-7, 12),
      createdBy: 'u-admin',
      updatedAt: mockEventAt(-1, 12),
      updatedBy: 'u-admin',
      version: 1,
    },
    {
      id: nextId(),
      organizationId,
      siteId: 'site-centro',
      name: 'Reunión de líderes',
      description: 'Planificación del trimestre.',
      kind: 'MEETING',
      startAt: mockEventAt(2, 19, 0),
      endAt: mockEventAt(2, 21, 0),
      allDay: false,
      status: 'DRAFT',
      createdAt: mockEventAt(-1, 12),
      createdBy: 'u-admin',
      updatedAt: mockEventAt(-1, 12),
      updatedBy: 'u-admin',
      version: 1,
    },
    {
      id: nextId(),
      organizationId,
      siteId: 'site-centro',
      name: 'Conferencia anual',
      description: 'Tres días de capacitación.',
      kind: 'OTHER',
      startAt: mockEventAt(10, 13, 0),
      endAt: mockEventAt(12, 22, 0),
      allDay: false,
      status: 'PUBLISHED',
      createdAt: mockEventAt(-14, 12),
      createdBy: 'u-admin',
      updatedAt: mockEventAt(-1, 12),
      updatedBy: 'u-admin',
      version: 3,
    },
    {
      id: nextId(),
      organizationId,
      siteId: 'site-centro',
      name: 'Culto pasado',
      description: 'Servicio ya realizado.',
      kind: 'SERVICE',
      startAt: mockEventAt(-3, 22, 0),
      endAt: mockEventAt(-3, 23, 30),
      allDay: false,
      status: 'COMPLETED',
      createdAt: mockEventAt(-10, 12),
      createdBy: 'u-admin',
      updatedAt: mockEventAt(-3, 23, 30),
      updatedBy: 'u-admin',
      version: 1,
    },
  ];
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

function mockResources_(organizationId: string) {
  const now = new Date().toISOString();
  return [
    {
      id: 'res-serial-001',
      organizationId,
      siteId: 'site-1',
      name: 'Proyector Epson PowerLite',
      description: 'Proyector para salón principal',
      inventoryType: 'SERIALIZED' as const,
      status: 'AVAILABLE' as const,
      quantity: 1,
      unit: 'unidad',
      brand: 'Epson',
      model: 'PowerLite 2040',
      serialNumber: 'SN-EPS-001',
      internalCode: 'PROY-001',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'res-serial-002',
      organizationId,
      siteId: 'site-1',
      name: 'Consola de sonido Allen & Heath',
      description: 'Mezcladora 16 canales',
      inventoryType: 'SERIALIZED' as const,
      status: 'IN_USE' as const,
      quantity: 1,
      unit: 'unidad',
      brand: 'Allen & Heath',
      model: 'ZED-16',
      serialNumber: 'SN-AH-002',
      internalCode: 'SON-001',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'res-qty-001',
      organizationId,
      siteId: 'site-1',
      name: 'Sillas plegables',
      description: 'Para eventos y reuniones',
      inventoryType: 'QUANTITY' as const,
      status: 'AVAILABLE' as const,
      quantity: 50,
      unit: 'unidad',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'res-qty-002',
      organizationId,
      siteId: 'site-1',
      name: 'Cables XLR',
      description: 'Cables de 5m para audio',
      inventoryType: 'QUANTITY' as const,
      status: 'RETURN_PENDING' as const,
      quantity: 6,
      unit: 'unidad',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'res-broken-001',
      organizationId,
      siteId: 'site-1',
      name: 'Micrófono Shure',
      description: 'Devuelto con fallas',
      inventoryType: 'SERIALIZED' as const,
      status: 'BROKEN' as const,
      quantity: 1,
      unit: 'unidad',
      brand: 'Shure',
      model: 'SM58',
      serialNumber: 'SN-SH-003',
      internalCode: 'MIC-003',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];
}

function mockLocations_(organizationId: string) {
  const now = new Date().toISOString();
  return [
    {
      id: 'loc-main',
      organizationId,
      siteId: 'site-1',
      name: 'Salón Principal',
      description: 'Capacidad para 200 personas, escenario y sistema de sonido.',
      capacity: 200,
      rules: 'Reservar con 48h de anticipación.',
      active: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'loc-class-101',
      organizationId,
      siteId: 'site-1',
      name: 'Aula 101',
      description: 'Aula con pupitres y pizarra.',
      capacity: 30,
      rules: '',
      active: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'loc-storage',
      organizationId,
      siteId: 'site-1',
      name: 'Depósito de sonido',
      description: 'Espacio de guardado de equipos.',
      capacity: 0,
      rules: 'Solo personal autorizado.',
      active: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];
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
    case 'resources.list': {
      return { ok: true, data: { resources: mockResources_(organizationId) } as T };
    }
    case 'resources.get': {
      const list = mockResources_(organizationId);
      const target = list.find((r) => r.id === (payload as { id?: string }).id);
      if (!target) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } };
      }
      const movements = [
        {
          id: nextId(),
          organizationId,
          resourceId: target.id,
          type: 'CREATE' as const,
          toStatus: 'AVAILABLE' as const,
          occurredAt: '2026-07-01T10:00:00Z',
        },
        {
          id: nextId(),
          organizationId,
          resourceId: target.id,
          type: 'MOVE' as const,
          fromLocationId: 'loc-storage',
          toLocationId: 'loc-main',
          occurredAt: '2026-07-15T10:00:00Z',
        },
        {
          id: nextId(),
          organizationId,
          resourceId: target.id,
          type: 'DELIVER' as const,
          fromStatus: 'AVAILABLE' as const,
          toStatus: 'IN_USE' as const,
          occurredAt: '2026-08-10T10:00:00Z',
        },
      ];
      return { ok: true, data: { resource: target, movements } as T };
    }
    case 'resources.listLocations': {
      return { ok: true, data: { locations: mockLocations_(organizationId) } as T };
    }
    case 'resources.getLocation': {
      const list = mockLocations_(organizationId);
      const target = list.find((l) => l.id === (payload as { id?: string }).id);
      if (!target) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Espacio no encontrado' } };
      }
      return { ok: true, data: { location: target } as T };
    }
    case 'resources.listReservations': {
      const reservations = [
        {
          id: 'resv-001',
          organizationId,
          kind: 'LOCATION' as const,
          targetId: 'loc-main',
          requestId: 'req-001',
          startAt: '2026-08-31T18:00:00Z',
          endAt: '2026-08-31T21:00:00Z',
          quantity: 1,
          status: 'CONFIRMED' as const,
          createdAt: '2026-08-15T10:00:00Z',
          updatedAt: '2026-08-15T10:00:00Z',
          version: 1,
        },
        {
          id: 'resv-002',
          organizationId,
          kind: 'RESOURCE' as const,
          targetId: 'res-qty-001',
          requestId: 'req-002',
          startAt: '2026-09-05T17:00:00Z',
          endAt: '2026-09-05T22:00:00Z',
          quantity: 40,
          status: 'PENDING_RESERVATION' as const,
          createdAt: '2026-08-25T10:00:00Z',
          updatedAt: '2026-08-25T10:00:00Z',
          version: 1,
        },
      ];
      return { ok: true, data: { reservations } as T };
    }
    case 'resources.listMovements': {
      const now = new Date().toISOString();
      const resourceId = (payload as { resourceId?: string }).resourceId ?? 'res-serial-001';
      const movements = [
        {
          id: 'mov-001',
          organizationId,
          resourceId,
          type: 'DELIVER' as const,
          fromStatus: 'AVAILABLE' as const,
          toStatus: 'DELIVERED' as const,
          occurredAt: '2026-08-10T15:00:00Z',
        },
        {
          id: 'mov-002',
          organizationId,
          resourceId,
          type: 'RETURN' as const,
          fromStatus: 'DELIVERED' as const,
          toStatus: 'AVAILABLE' as const,
          occurredAt: '2026-08-12T11:00:00Z',
        },
        {
          id: 'mov-003',
          organizationId,
          resourceId,
          type: 'MOVE' as const,
          fromLocationId: 'loc-storage',
          toLocationId: 'loc-main',
          occurredAt: now,
        },
      ];
      return { ok: true, data: { movements } as T };
    }
    case 'resources.checkAvailability': {
      const items =
        ((payload as { items?: unknown }).items as Array<{
          resourceId?: string;
          locationId?: string;
        }>) ?? [];
      const available = {
        resource: {} as Record<string, boolean>,
        location: {} as Record<string, boolean>,
      };
      items.forEach((it) => {
        if (it.resourceId) available.resource[it.resourceId] = true;
        if (it.locationId) available.location[it.locationId] = true;
      });
      return { ok: true, data: { available, conflicts: [] } as T };
    }
    case 'events.list': {
      const events = buildMockEvents(organizationId);
      return { ok: true, data: { events } as T };
    }
    case 'events.get': {
      const events = buildMockEvents(organizationId);
      const event = events[0];
      return {
        ok: true,
        data: {
          event: {
            ...event,
            areas: [
              {
                id: nextId(),
                organizationId,
                eventId: event.id,
                areaId: 'area-alabanza',
                responsibility: 'LEAD',
              },
              {
                id: nextId(),
                organizationId,
                eventId: event.id,
                areaId: 'area-ninos',
                responsibility: 'SUPPORT',
              },
            ],
            resources: [
              {
                id: nextId(),
                organizationId,
                eventId: event.id,
                resourceId: 'res-sonido',
                quantity: 1,
              },
              {
                id: nextId(),
                organizationId,
                eventId: event.id,
                resourceId: 'res-sillas',
                quantity: 80,
              },
            ],
            people: [
              { id: nextId(), organizationId, eventId: event.id, personId: 'p-dir1', role: 'LEAD' },
              {
                id: nextId(),
                organizationId,
                eventId: event.id,
                personId: 'p-vol1',
                role: 'ATTENDEE',
              },
            ],
            template: {
              id: nextId(),
              organizationId,
              name: 'Plantilla Culto',
              description: 'Esqueleto estándar de servicio dominical.',
              durationMinutes: 90,
              defaultAreas: ['area-alabanza', 'area-ninos'],
              defaultResources: { 'res-sonido': 1, 'res-sillas': 100 },
            },
          },
        } as T,
      };
    }
    case 'events.upcoming': {
      const events = buildMockEvents(organizationId).filter(
        (e) => new Date(e.endAt).getTime() >= Date.now(),
      );
      return { ok: true, data: { events } as T };
    }
    default:
      return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Mock no soporta ${action}` } };
  }
}
