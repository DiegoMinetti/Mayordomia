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

// --------------------------------------------------------------------------- //
//  Ola 3 — Operations / Maintenance / Purchases mock state                   //
// --------------------------------------------------------------------------- //
interface DeliveryMockSnapshot {
  deliveries: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  /** idem key → deliveryId, for idempotent re-submission. */
  idempotency: Map<string, string>;
}
interface MaintenanceMockSnapshot {
  list: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
}
const deliveryMockSnapshots = new Map<string, DeliveryMockSnapshot>();
const maintenanceMockSnapshots = new Map<string, MaintenanceMockSnapshot>();

interface MockSupplier {
  id: string;
  organizationId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  rating?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}
interface MockPurchaseRequest {
  id: string;
  organizationId: string;
  siteId?: string;
  needId?: string;
  title: string;
  description?: string;
  status: string;
  requesterId?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  itemCount: number;
  quoteCount: number;
  estimatedTotal: number;
}
interface MockPurchaseItem {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  version: number;
}
interface MockQuote {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  supplierId: string;
  price: number;
  currency: string;
  qualityScore: number;
  deliveryDays: number;
  warrantyMonths: number;
  technicalFitScore: number;
  notes?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  submittedAt: string;
  version: number;
  supplierName?: string;
}
interface MockDecision {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  decidedBy: string;
  decidedAt: string;
  chosenQuoteId: string;
  justification?: string;
  weightConfig: Record<string, number>;
  scores: Array<{
    quoteId: string;
    score: number;
    breakdown: Record<string, { normalized: number; weight: number; contribution: number }>;
  }>;
  version: number;
}
interface PurchasesMockSnapshot {
  suppliers: MockSupplier[];
  requests: MockPurchaseRequest[];
  items: MockPurchaseItem[];
  quotes: MockQuote[];
  decisions: MockDecision[];
}
const purchasesMockSnapshots = new Map<string, PurchasesMockSnapshot>();

function ensureDeliveryMock(organizationId: string): DeliveryMockSnapshot {
  const cached = deliveryMockSnapshots.get(organizationId);
  if (cached) return cached;
  const now = new Date().toISOString();
  const deliveries: DeliveryMockSnapshot['deliveries'] = [
    {
      id: 'mock-del-001',
      organizationId,
      requestId: 'mock-req-0003',
      deliveredBy: 'u-operador',
      deliveredAt: '2026-08-28T08:00:00Z',
      siteId: 'mock-site-0001',
      recipientName: 'Ana Suárez',
      notes: 'Salón listo antes del ensayo.',
      status: 'COMPLETED',
      createdAt: '2026-08-28T07:55:00Z',
      updatedAt: '2026-08-28T11:00:00Z',
      createdBy: 'u-operador',
      updatedBy: 'u-operador',
      version: 2,
    },
    {
      id: 'mock-del-002',
      organizationId,
      requestId: 'mock-req-0002',
      deliveredBy: 'u-operador',
      deliveredAt: '2026-08-30T10:00:00Z',
      siteId: 'mock-site-0001',
      recipientName: 'Luis Pérez',
      notes: 'Sillas entregadas al salón principal.',
      status: 'IN_PROGRESS',
      createdAt: '2026-08-30T09:50:00Z',
      updatedAt: '2026-08-30T10:00:00Z',
      createdBy: 'u-operador',
      updatedBy: 'u-operador',
      version: 1,
    },
    {
      id: 'mock-del-003',
      organizationId,
      requestId: 'mock-req-0006',
      deliveredBy: 'u-operador',
      deliveredAt: now,
      siteId: 'mock-site-0001',
      recipientName: 'Diego Minetti',
      notes: 'Notebook entregado con cargador.',
      status: 'IN_PROGRESS',
      createdAt: now,
      updatedAt: now,
      createdBy: 'u-operador',
      updatedBy: 'u-operador',
      version: 1,
    },
  ];
  const idempotency = new Map<string, string>([
    ['mock-idem-001', 'mock-del-001'],
    ['mock-idem-002', 'mock-del-002'],
    ['mock-idem-003', 'mock-del-003'],
  ]);
  const items: DeliveryMockSnapshot['items'] = [
    {
      id: 'mock-deli-001a',
      organizationId,
      deliveryId: 'mock-del-001',
      resourceId: 'loc-class-101',
      quantity: 1,
      returnedAt: '2026-08-28T11:00:00Z',
      returnedBy: 'u-operador',
      returnedQuantity: 1,
      condition: 'OK',
      version: 2,
    },
    {
      id: 'mock-deli-002a',
      organizationId,
      deliveryId: 'mock-del-002',
      resourceId: 'res-qty-001',
      quantity: 20,
      returnedAt: '2026-08-30T22:00:00Z',
      returnedBy: 'u-operador',
      returnedQuantity: 20,
      condition: 'OK',
      version: 2,
    },
    {
      id: 'mock-deli-002b',
      organizationId,
      deliveryId: 'mock-del-002',
      resourceId: 'res-qty-002',
      quantity: 4,
      version: 1,
    },
    {
      id: 'mock-deli-003a',
      organizationId,
      deliveryId: 'mock-del-003',
      resourceId: 'res-serial-001',
      quantity: 1,
      version: 1,
    },
  ];
  const snapshot: DeliveryMockSnapshot = { deliveries, items, idempotency };
  deliveryMockSnapshots.set(organizationId, snapshot);
  return snapshot;
}

function mockDeliveryProgress_(items: Array<Record<string, unknown>>) {
  const total = items.length;
  const returned = items.filter((it) => it.returnedAt).length;
  const damage = items.filter((it) => it.condition === 'DAMAGED').length;
  return {
    totalItems: total,
    returnedItems: returned,
    openItems: total - returned,
    damageCount: damage,
  };
}

function mockRequestHeaderForDelivery_(delivery: Record<string, unknown>) {
  return {
    id: String(delivery.requestId),
    type: 'RESOURCE',
    requesterName: 'Solicitante',
    description: 'Detalle de la solicitud',
    siteId: delivery.siteId ? String(delivery.siteId) : undefined,
  };
}

function ensureMaintenanceMock(organizationId: string): MaintenanceMockSnapshot {
  const cached = maintenanceMockSnapshots.get(organizationId);
  if (cached) return cached;
  const list: MaintenanceMockSnapshot['list'] = [
    {
      id: 'mock-mnt-001',
      organizationId,
      siteId: 'mock-site-0001',
      resourceId: 'res-broken-001',
      reportedBy: 'u-operador',
      reportedAt: '2026-08-22T10:00:00Z',
      kind: 'CORRECTIVE',
      severity: 'HIGH',
      status: 'IN_PROGRESS',
      description: 'Micrófono sin señal. Diagnóstico inicial: cable interno cortado.',
      startedAt: '2026-08-23T09:00:00Z',
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-23T09:00:00Z',
      createdBy: 'u-operador',
      updatedBy: 'u-tecnico',
      version: 2,
    },
    {
      id: 'mock-mnt-002',
      organizationId,
      siteId: 'mock-site-0001',
      reportedBy: 'u-pastor',
      reportedAt: '2026-08-15T14:00:00Z',
      kind: 'INSPECTION',
      severity: 'LOW',
      status: 'RESOLVED',
      description: 'Inspección trimestral del sistema de sonido.',
      resolution: 'Limpieza general y reapriete de bornes. Sin novedades.',
      resolvedAt: '2026-08-16T10:00:00Z',
      startedAt: '2026-08-15T14:00:00Z',
      createdAt: '2026-08-15T14:00:00Z',
      updatedAt: '2026-08-16T10:00:00Z',
      createdBy: 'u-pastor',
      updatedBy: 'u-tecnico',
      version: 3,
    },
    {
      id: 'mock-mnt-003',
      organizationId,
      siteId: 'mock-site-0002',
      reportedBy: 'u-voluntario',
      reportedAt: '2026-08-10T09:00:00Z',
      kind: 'PREVENTIVE',
      severity: 'MEDIUM',
      status: 'OPEN',
      description: 'Programar cambio de baterías del sistema de alarmas.',
      createdAt: '2026-08-10T09:00:00Z',
      updatedAt: '2026-08-10T09:00:00Z',
      createdBy: 'u-voluntario',
      updatedBy: 'u-voluntario',
      version: 1,
    },
    {
      id: 'mock-mnt-004',
      organizationId,
      siteId: 'mock-site-0001',
      reportedBy: 'u-operador',
      reportedAt: '2026-07-30T10:00:00Z',
      kind: 'CORRECTIVE',
      severity: 'MEDIUM',
      status: 'CANCELLED',
      description: 'Aire acondicionado del salón — finalmente resuelto por proveedor externo.',
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-08-05T12:00:00Z',
      createdBy: 'u-operador',
      updatedBy: 'u-operador',
      version: 2,
    },
  ];
  const updates: MaintenanceMockSnapshot['updates'] = [
    {
      id: 'mock-mntu-001a',
      organizationId,
      maintenanceId: 'mock-mnt-001',
      authorId: 'u-operador',
      at: '2026-08-22T10:00:00Z',
      kind: 'NOTE',
      text: 'Reporte creado. Se envía a técnico.',
      createdAt: '2026-08-22T10:00:00Z',
      version: 1,
    },
    {
      id: 'mock-mntu-001b',
      organizationId,
      maintenanceId: 'mock-mnt-001',
      authorId: 'u-tecnico',
      at: '2026-08-23T09:00:00Z',
      kind: 'STATUS',
      text: 'Estado: IN_PROGRESS',
      createdAt: '2026-08-23T09:00:00Z',
      version: 1,
    },
    {
      id: 'mock-mntu-002a',
      organizationId,
      maintenanceId: 'mock-mnt-002',
      authorId: 'u-pastor',
      at: '2026-08-15T14:00:00Z',
      kind: 'NOTE',
      text: 'Inspección programada.',
      createdAt: '2026-08-15T14:00:00Z',
      version: 1,
    },
    {
      id: 'mock-mntu-002b',
      organizationId,
      maintenanceId: 'mock-mnt-002',
      authorId: 'u-tecnico',
      at: '2026-08-16T10:00:00Z',
      kind: 'RESOLUTION',
      text: 'Limpieza general y reapriete de bornes. Sin novedades.',
      createdAt: '2026-08-16T10:00:00Z',
      version: 1,
    },
  ];
  const snapshot: MaintenanceMockSnapshot = { list, updates };
  maintenanceMockSnapshots.set(organizationId, snapshot);
  return snapshot;
}

function ensurePurchasesMock(organizationId: string): PurchasesMockSnapshot {
  const cached = purchasesMockSnapshots.get(organizationId);
  if (cached) return cached;
  const now = new Date().toISOString();
  const suppliers: MockSupplier[] = [
    {
      id: 'sup-audio-1',
      organizationId,
      name: 'Sonido Profesional SA',
      contactName: 'Carlos Méndez',
      email: 'ventas@sonidoprofessional.example',
      phone: '+54 11 4555-0101',
      notes: 'Atiende en CABA, entrega en 48h.',
      rating: 4.6,
      active: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'sup-muebles-1',
      organizationId,
      name: 'Muebles del Sur',
      contactName: 'Laura Pérez',
      email: 'laura@mueblesdelsur.example',
      phone: '+54 11 4444-2020',
      notes: 'Cotiza en USD, pedir proforma.',
      rating: 4.2,
      active: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'sup-luces-1',
      organizationId,
      name: 'Iluminaciones Norte',
      contactName: 'Diego Castro',
      email: 'diego@iluminacionesnorte.example',
      phone: '+54 11 4777-3030',
      notes: 'Stock local, mejor precio para volúmenes grandes.',
      rating: 3.8,
      active: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'sup-inactivo-1',
      organizationId,
      name: 'Proveedor Viejo',
      contactName: 'Alguien',
      email: 'a@b.example',
      phone: '',
      notes: 'Dado de baja por incumplimiento.',
      rating: 2.0,
      active: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];

  const requests: MockPurchaseRequest[] = [
    {
      id: 'pr-0001',
      organizationId,
      siteId: 'site-centro',
      needId: 'mock-req-0001',
      title: 'Cables XLR para consola principal',
      description: 'Reponer cables quemados en el último servicio.',
      status: 'COMPLETED',
      requesterId: 'u-admin',
      createdAt: '2026-08-10T10:00:00Z',
      updatedAt: '2026-08-12T10:00:00Z',
      version: 3,
      itemCount: 1,
      quoteCount: 2,
      estimatedTotal: 60000,
    },
    {
      id: 'pr-0002',
      organizationId,
      siteId: 'site-centro',
      needId: 'mock-req-0005',
      title: 'Reparación de aire acondicionado salón principal',
      description: 'El equipo hace ruido y no enfría bien.',
      status: 'APPROVED',
      requesterId: 'u-admin',
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-26T15:00:00Z',
      version: 2,
      itemCount: 1,
      quoteCount: 3,
      estimatedTotal: 180000,
    },
    {
      id: 'pr-0003',
      organizationId,
      siteId: 'site-norte',
      title: 'Sillas plegables adicionales',
      description: 'Compra de 30 sillas para eventos grandes.',
      status: 'SUBMITTED',
      requesterId: 'u-vol-1',
      createdAt: '2026-08-28T10:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
      version: 1,
      itemCount: 1,
      quoteCount: 2,
      estimatedTotal: 450000,
    },
    {
      id: 'pr-0004',
      organizationId,
      siteId: 'site-centro',
      title: 'Micrófonos inalámbricos',
      description: 'Reemplazar los que se romieron.',
      status: 'CANCELLED',
      requesterId: 'u-admin',
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-08-02T10:00:00Z',
      version: 1,
      itemCount: 1,
      quoteCount: 0,
      estimatedTotal: 0,
    },
  ];

  const items: MockPurchaseItem[] = [
    {
      id: 'pri-0001',
      organizationId,
      purchaseRequestId: 'pr-0001',
      name: 'Cable XLR 5m',
      description: 'Cable balanceado para línea de audio.',
      quantity: 6,
      unit: 'unidad',
      estimatedCost: 10000,
      version: 1,
    },
    {
      id: 'pri-0002',
      organizationId,
      purchaseRequestId: 'pr-0002',
      name: 'Servicio técnico aire acondicionado',
      description: 'Reparación + carga de gas.',
      quantity: 1,
      unit: 'servicio',
      estimatedCost: 180000,
      version: 1,
    },
    {
      id: 'pri-0003',
      organizationId,
      purchaseRequestId: 'pr-0003',
      name: 'Silla plegable acero',
      description: 'Silla reforzada para uso intensivo.',
      quantity: 30,
      unit: 'unidad',
      estimatedCost: 15000,
      version: 1,
    },
    {
      id: 'pri-0004',
      organizationId,
      purchaseRequestId: 'pr-0004',
      name: 'Micrófono inalámbrico UHF',
      description: 'Set de 2 micrófonos con receptor.',
      quantity: 2,
      unit: 'set',
      estimatedCost: undefined,
      version: 1,
    },
  ];

  const quotes: MockQuote[] = [
    {
      id: 'q-0001-a',
      organizationId,
      purchaseRequestId: 'pr-0001',
      supplierId: 'sup-audio-1',
      price: 48000,
      currency: 'ARS',
      qualityScore: 90,
      deliveryDays: 3,
      warrantyMonths: 12,
      technicalFitScore: 95,
      notes: 'Stock inmediato.',
      status: 'ACCEPTED',
      submittedAt: '2026-08-11T10:00:00Z',
      version: 2,
    },
    {
      id: 'q-0001-b',
      organizationId,
      purchaseRequestId: 'pr-0001',
      supplierId: 'sup-luces-1',
      price: 52000,
      currency: 'ARS',
      qualityScore: 80,
      deliveryDays: 7,
      warrantyMonths: 6,
      technicalFitScore: 70,
      notes: 'Buen precio pero demora.',
      status: 'REJECTED',
      submittedAt: '2026-08-11T12:00:00Z',
      version: 2,
    },
    {
      id: 'q-0002-a',
      organizationId,
      purchaseRequestId: 'pr-0002',
      supplierId: 'sup-audio-1',
      price: 195000,
      currency: 'ARS',
      qualityScore: 88,
      deliveryDays: 2,
      warrantyMonths: 6,
      technicalFitScore: 90,
      notes: 'Visita técnica gratuita.',
      status: 'ACCEPTED',
      submittedAt: '2026-08-23T10:00:00Z',
      version: 2,
    },
    {
      id: 'q-0002-b',
      organizationId,
      purchaseRequestId: 'pr-0002',
      supplierId: 'sup-muebles-1',
      price: 175000,
      currency: 'ARS',
      qualityScore: 75,
      deliveryDays: 5,
      warrantyMonths: 3,
      technicalFitScore: 70,
      notes: 'No incluye repuestos originales.',
      status: 'REJECTED',
      submittedAt: '2026-08-23T14:00:00Z',
      version: 2,
    },
    {
      id: 'q-0002-c',
      organizationId,
      purchaseRequestId: 'pr-0002',
      supplierId: 'sup-luces-1',
      price: 220000,
      currency: 'ARS',
      qualityScore: 92,
      deliveryDays: 4,
      warrantyMonths: 12,
      technicalFitScore: 85,
      notes: 'Garantía extendida.',
      status: 'REJECTED',
      submittedAt: '2026-08-24T09:00:00Z',
      version: 2,
    },
    {
      id: 'q-0003-a',
      organizationId,
      purchaseRequestId: 'pr-0003',
      supplierId: 'sup-muebles-1',
      price: 420000,
      currency: 'ARS',
      qualityScore: 85,
      deliveryDays: 10,
      warrantyMonths: 6,
      technicalFitScore: 80,
      notes: 'Descuento por volumen.',
      status: 'PENDING',
      submittedAt: '2026-08-28T18:00:00Z',
      version: 1,
    },
    {
      id: 'q-0003-b',
      organizationId,
      purchaseRequestId: 'pr-0003',
      supplierId: 'sup-luces-1',
      price: 450000,
      currency: 'ARS',
      qualityScore: 78,
      deliveryDays: 7,
      warrantyMonths: 3,
      technicalFitScore: 75,
      notes: 'Modelo alternativo más barato.',
      status: 'PENDING',
      submittedAt: '2026-08-29T10:00:00Z',
      version: 1,
    },
  ];

  const decisions: MockDecision[] = [
    {
      id: 'pd-0001',
      organizationId,
      purchaseRequestId: 'pr-0001',
      decidedBy: 'u-admin',
      decidedAt: '2026-08-12T10:00:00Z',
      chosenQuoteId: 'q-0001-a',
      justification: undefined,
      weightConfig: {
        price: 30,
        quality: 25,
        delivery: 15,
        warranty: 10,
        supplierHistory: 10,
        technicalFit: 10,
      },
      scores: [],
      version: 1,
    },
    {
      id: 'pd-0002',
      organizationId,
      purchaseRequestId: 'pr-0002',
      decidedBy: 'u-admin',
      decidedAt: '2026-08-26T15:00:00Z',
      chosenQuoteId: 'q-0002-a',
      justification: 'Mejor score general: precio-calidad-garantía equilibrados.',
      weightConfig: {
        price: 30,
        quality: 25,
        delivery: 15,
        warranty: 10,
        supplierHistory: 10,
        technicalFit: 10,
      },
      scores: [],
      version: 1,
    },
  ];

  const snapshot: PurchasesMockSnapshot = {
    suppliers,
    requests,
    items,
    quotes,
    decisions,
  };
  purchasesMockSnapshots.set(organizationId, snapshot);
  return snapshot;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function deliveryScore_(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0;
  if (days <= 3) return 100;
  if (days >= 60) return 0;
  return Math.round((1 - (days - 3) / 57) * 100);
}
function warrantyScore_(months: number): number {
  if (!Number.isFinite(months) || months < 0) return 0;
  if (months >= 24) return 100;
  if (months === 0) return 30;
  return Math.round((months / 24) * 100);
}
function supplierHistoryScore_(supplier: MockSupplier | { rating?: unknown } | undefined): number {
  if (!supplier) return 50;
  const r = Number((supplier as { rating?: unknown }).rating || 0);
  if (!Number.isFinite(r) || r <= 0) return 50;
  return Math.max(0, Math.min(100, Math.round((r / 5) * 100)));
}

function scoreMockQuotes(
  quotes: Array<{
    quoteId: string;
    price: number;
    quality: number;
    delivery: number;
    warranty: number;
    supplierHistory: number;
    technicalFit: number;
  }>,
  weights: Record<string, number>,
): Array<{
  quoteId: string;
  score: number;
  breakdown: Record<string, { normalized: number; weight: number; contribution: number }>;
}> {
  const keys = ['price', 'quality', 'delivery', 'warranty', 'supplierHistory', 'technicalFit'];
  const total = keys.reduce((a, k) => a + (Number(weights[k] || 0) || 0), 0);
  if (total <= 0) throw new Error('Weights must total more than zero');
  const prices = quotes.map((q) => q.price);
  if (prices.some((p) => p <= 0)) throw new Error('Prices must be positive');
  const minPrice = Math.min(...prices);
  return quotes
    .map((q) => {
      const normalized = { ...q, price: (minPrice / q.price) * 100 };
      const breakdown: Record<
        string,
        { normalized: number; weight: number; contribution: number }
      > = {};
      let score = 0;
      for (const key of keys) {
        const value =
          key === 'price'
            ? normalized.price
            : Math.max(0, Math.min(100, (q as unknown as Record<string, number>)[key]));
        const contribution = (value * (Number(weights[key] || 0) || 0)) / total;
        breakdown[key] = {
          normalized: round4(value),
          weight: Number(weights[key] || 0),
          contribution: round4(contribution),
        };
        score += contribution;
      }
      return { quoteId: q.quoteId, score: round2(score), breakdown };
    })
    .sort((a, b) => b.score - a.score);
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
    // ----------------------------------------------------------------------- //
    //  Ola 3a — Operations / Maintenance (mock data)                          //
    // ----------------------------------------------------------------------- //
    case 'operations.listDeliveries': {
      const snapshot = ensureDeliveryMock(organizationId);
      return { ok: true, data: { deliveries: snapshot.deliveries.map((d) => ({ ...d })) } as T };
    }
    case 'operations.getDelivery': {
      const id = String((payload as { id?: string }).id || '');
      const snapshot = ensureDeliveryMock(organizationId);
      const delivery = snapshot.deliveries.find((d) => d.id === id);
      if (!delivery) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Entrega no encontrada' } };
      }
      const items = snapshot.items.filter((it) => it.deliveryId === id).map((it) => ({ ...it }));
      const resources = mockResources_(organizationId);
      const progress = mockDeliveryProgress_(items);
      const request = mockRequestHeaderForDelivery_(delivery);
      return {
        ok: true,
        data: {
          delivery: { ...delivery },
          items,
          progress,
          request,
          resources: resources
            .filter((r) => items.some((it) => it.resourceId === r.id))
            .reduce<Record<string, { id: string; name: string; status: string }>>((acc, r) => {
              acc[r.id] = { id: r.id, name: r.name, status: r.status };
              return acc;
            }, {}),
        } as T,
      };
    }
    case 'operations.deliver': {
      const body = payload as {
        idempotencyKey?: string;
        requestId?: string;
        expectedVersion?: number;
        deliveredBy?: string;
        deliveredAt?: string;
        siteId?: string;
        recipientName?: string;
        notes?: string;
        items?: Array<{ resourceId: string; quantity: number }>;
      };
      if (
        !body.idempotencyKey ||
        !body.requestId ||
        !body.deliveredBy ||
        !body.recipientName ||
        !Array.isArray(body.items) ||
        body.items.length === 0
      ) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Faltan campos obligatorios' },
        };
      }
      const snapshot = ensureDeliveryMock(organizationId);
      const existingId = snapshot.idempotency.get(body.idempotencyKey);
      if (existingId) {
        const existing = snapshot.deliveries.find((d) => d.id === existingId);
        if (existing) {
          const items = snapshot.items
            .filter((it) => it.deliveryId === existing.id)
            .map((it) => ({ ...it }));
          return {
            ok: true,
            data: {
              delivery: { ...existing },
              items,
              resourceIds: items.map((it) => it.resourceId),
            } as T,
          };
        }
      }
      const deliveryId = `mock-del-${nextId()}`;
      const now = body.deliveredAt || new Date().toISOString();
      const delivery = {
        id: deliveryId,
        organizationId,
        requestId: body.requestId,
        deliveredBy: body.deliveredBy,
        deliveredAt: now,
        siteId: body.siteId,
        recipientName: body.recipientName,
        notes: body.notes,
        status: 'IN_PROGRESS',
        createdAt: now,
        updatedAt: now,
        createdBy: body.deliveredBy,
        updatedBy: body.deliveredBy,
        version: 1,
      };
      snapshot.idempotency.set(body.idempotencyKey, deliveryId);
      const items = body.items.map((it) => ({
        id: `mock-deli-${nextId()}`,
        organizationId,
        deliveryId,
        resourceId: it.resourceId,
        quantity: it.quantity,
        version: 1,
      }));
      snapshot.deliveries.push(delivery);
      snapshot.items.push(...items);
      return {
        ok: true,
        data: {
          delivery: { ...delivery },
          items: items.map((it) => ({ ...it })),
          resourceIds: items.map((it) => it.resourceId),
        } as T,
      };
    }
    case 'operations.returnDeliveryItem': {
      const body = payload as {
        deliveryItemId?: string;
        expectedVersion?: number;
        condition?: 'OK' | 'DAMAGED' | 'LOST';
        returnedBy?: string;
        returnedAt?: string;
        returnedQuantity?: number;
        notes?: string;
      };
      if (!body.deliveryItemId || !body.condition || !body.returnedBy || !body.expectedVersion) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Faltan campos obligatorios' },
        };
      }
      const snapshot = ensureDeliveryMock(organizationId);
      const item = snapshot.items.find((it) => it.id === body.deliveryItemId);
      if (!item) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Item no encontrado' } };
      }
      if (Number(item.version) !== Number(body.expectedVersion)) {
        return {
          ok: false,
          error: {
            code: 'VERSION_MISMATCH',
            message: 'El item fue modificado por otro usuario',
          },
        };
      }
      if (item.returnedAt) {
        return {
          ok: false,
          error: { code: 'ALREADY_RETURNED', message: 'El item ya fue devuelto' },
        };
      }
      const now = body.returnedAt || new Date().toISOString();
      item.returnedAt = now;
      item.returnedBy = body.returnedBy;
      item.returnNotes = body.notes;
      item.returnedQuantity = body.returnedQuantity ?? item.quantity;
      item.condition = body.condition;
      item.version = Number(item.version) + 1;
      const newStatus =
        body.condition === 'DAMAGED'
          ? 'BROKEN'
          : body.condition === 'LOST'
            ? 'MISSING'
            : 'AVAILABLE';
      const maintenance = ensureMaintenanceMock(organizationId);
      let maintenanceId: string | undefined;
      if (body.condition === 'DAMAGED') {
        const m = {
          id: `mock-mnt-${nextId()}`,
          organizationId,
          siteId: snapshot.deliveries.find((d) => d.id === item.deliveryId)?.siteId,
          resourceId: item.resourceId,
          reportedBy: body.returnedBy,
          reportedAt: now,
          kind: 'CORRECTIVE' as const,
          severity: 'MEDIUM' as const,
          status: 'OPEN' as const,
          description: body.notes ? `Devuelto con daños: ${body.notes}` : 'Devuelto con daños',
          sourceDeliveryItemId: item.id,
          createdAt: now,
          updatedAt: now,
          createdBy: body.returnedBy,
          updatedBy: body.returnedBy,
          version: 1,
        };
        maintenance.list.push(m);
        maintenance.updates.push({
          id: `mock-mntu-${nextId()}`,
          organizationId,
          maintenanceId: m.id,
          authorId: body.returnedBy,
          at: now,
          kind: 'NOTE',
          text: 'Generado automáticamente al recibir el item con daños.',
          createdAt: now,
          version: 1,
        });
        maintenanceId = m.id;
      }
      return {
        ok: true,
        data: {
          item: { ...item },
          resourceId: String(item.resourceId),
          newStatus,
          maintenanceId,
        } as T,
      };
    }
    case 'maintenance.list': {
      const maintenance = ensureMaintenanceMock(organizationId);
      return { ok: true, data: { maintenance: maintenance.list.map((row) => ({ ...row })) } as T };
    }
    case 'maintenance.get': {
      const id = String((payload as { id?: string }).id || '');
      const maintenance = ensureMaintenanceMock(organizationId);
      const m = maintenance.list.find((row) => row.id === id);
      if (!m) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Mantenimiento no encontrado' } };
      }
      const updates = maintenance.updates
        .filter((u) => u.maintenanceId === id)
        .map((u) => ({ ...u }));
      const resources = mockResources_(organizationId);
      const resource = m.resourceId ? resources.find((r) => r.id === m.resourceId) : undefined;
      return {
        ok: true,
        data: {
          maintenance: { ...m },
          updates,
          resource: resource
            ? { id: resource.id, name: resource.name, status: resource.status }
            : undefined,
        } as T,
      };
    }
    case 'maintenance.create': {
      const body = payload as {
        resourceId?: string;
        siteId?: string;
        kind?: 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION';
        severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        description?: string;
        reportedBy?: string;
        sourceDeliveryItemId?: string;
      };
      if (!body.kind || !body.severity || !body.description || !body.reportedBy) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Faltan campos obligatorios' },
        };
      }
      const maintenance = ensureMaintenanceMock(organizationId);
      const now = new Date().toISOString();
      const m = {
        id: `mock-mnt-${nextId()}`,
        organizationId,
        siteId: body.siteId,
        resourceId: body.resourceId,
        reportedBy: body.reportedBy,
        reportedAt: now,
        kind: body.kind,
        severity: body.severity,
        status: 'OPEN' as const,
        description: body.description,
        sourceDeliveryItemId: body.sourceDeliveryItemId,
        createdAt: now,
        updatedAt: now,
        createdBy: body.reportedBy,
        updatedBy: body.reportedBy,
        version: 1,
      };
      maintenance.list.push(m);
      maintenance.updates.push({
        id: `mock-mntu-${nextId()}`,
        organizationId,
        maintenanceId: m.id,
        authorId: body.reportedBy,
        at: now,
        kind: 'NOTE',
        text: 'Reporte creado.',
        createdAt: now,
        version: 1,
      });
      return { ok: true, data: { maintenance: m } as T };
    }
    case 'maintenance.update': {
      const body = payload as {
        id?: string;
        expectedVersion?: number;
        status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
        resolution?: string;
        cost?: number;
        note?: string;
        actorId?: string;
      };
      if (!body.id || !body.expectedVersion || !body.actorId) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Faltan campos obligatorios' },
        };
      }
      const maintenance = ensureMaintenanceMock(organizationId);
      const m = maintenance.list.find((row) => row.id === body.id);
      if (!m) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Mantenimiento no encontrado' } };
      }
      if (Number(m.version) !== Number(body.expectedVersion)) {
        return {
          ok: false,
          error: {
            code: 'VERSION_MISMATCH',
            message: 'El mantenimiento fue modificado por otro usuario',
          },
        };
      }
      const now = new Date().toISOString();
      if (body.status) {
        m.status = body.status;
        if (body.status === 'IN_PROGRESS' && !m.startedAt) m.startedAt = now;
        if (body.status === 'RESOLVED') m.resolvedAt = now;
        maintenance.updates.push({
          id: `mock-mntu-${nextId()}`,
          organizationId,
          maintenanceId: m.id,
          authorId: body.actorId,
          at: now,
          kind: 'STATUS',
          text: `Estado: ${body.status}`,
          createdAt: now,
          version: 1,
        });
      }
      if (body.resolution) {
        m.resolution = body.resolution;
        m.status = 'RESOLVED';
        m.resolvedAt = now;
        maintenance.updates.push({
          id: `mock-mntu-${nextId()}`,
          organizationId,
          maintenanceId: m.id,
          authorId: body.actorId,
          at: now,
          kind: 'RESOLUTION',
          text: body.resolution,
          createdAt: now,
          version: 1,
        });
      }
      if (typeof body.cost === 'number' && Number.isFinite(body.cost)) {
        m.cost = body.cost;
        maintenance.updates.push({
          id: `mock-mntu-${nextId()}`,
          organizationId,
          maintenanceId: m.id,
          authorId: body.actorId,
          at: now,
          kind: 'COST',
          text: `Costo: ${body.cost}`,
          createdAt: now,
          version: 1,
        });
      }
      if (body.note) {
        maintenance.updates.push({
          id: `mock-mntu-${nextId()}`,
          organizationId,
          maintenanceId: m.id,
          authorId: body.actorId,
          at: now,
          kind: 'NOTE',
          text: body.note,
          createdAt: now,
          version: 1,
        });
      }
      m.updatedAt = now;
      m.updatedBy = body.actorId;
      m.version = Number(m.version) + 1;
      return { ok: true, data: { maintenance: { ...m } } as T };
    }
    // ----------------------------------------------------------------------- //
    //  Ola 3b — Compras / Proveedores (mock data)                             //
    // ----------------------------------------------------------------------- //
    case 'purchases.listSuppliers':
    case 'purchases.upsertSupplier': {
      const snap = ensurePurchasesMock(organizationId);
      if (action === 'purchases.listSuppliers') {
        return { ok: true, data: { suppliers: [...snap.suppliers] } as T };
      }
      const body = payload as {
        id?: string;
        name?: string;
        contactName?: string;
        email?: string;
        phone?: string;
        notes?: string;
        rating?: number;
        active?: boolean;
        expectedVersion?: number;
      };
      if (!body.name) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'name es obligatorio' } };
      }
      const now = new Date().toISOString();
      if (body.id) {
        const idx = snap.suppliers.findIndex((s) => s.id === body.id);
        if (idx < 0) {
          return { ok: false, error: { code: 'NOT_FOUND', message: 'Proveedor' } };
        }
        const current = snap.suppliers[idx];
        if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
          return {
            ok: false,
            error: { code: 'VERSION_MISMATCH', message: 'Proveedor modificado' },
          };
        }
        const updated = {
          ...current,
          name: body.name,
          contactName: body.contactName ?? current.contactName,
          email: body.email ?? current.email,
          phone: body.phone ?? current.phone,
          notes: body.notes ?? current.notes,
          rating: body.rating ?? current.rating,
          active: body.active === undefined ? current.active : !!body.active,
          updatedAt: now,
          version: current.version + 1,
        };
        snap.suppliers[idx] = updated;
        return { ok: true, data: { supplier: updated } as T };
      }
      const created = {
        id: nextId(),
        organizationId,
        name: body.name,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
        rating: body.rating,
        active: body.active === undefined ? true : !!body.active,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      snap.suppliers.push(created as MockSupplier);
      return { ok: true, data: { supplier: created } as T };
    }
    case 'purchases.listRequests': {
      const snap = ensurePurchasesMock(organizationId);
      const filters = payload as {
        status?: string;
        requesterId?: string;
        since?: string;
        until?: string;
      };
      let rows = [...snap.requests];
      if (filters.status) rows = rows.filter((r) => r.status === filters.status);
      if (filters.requesterId) rows = rows.filter((r) => r.requesterId === filters.requesterId);
      if (filters.since) rows = rows.filter((r) => r.createdAt >= filters.since!);
      if (filters.until) rows = rows.filter((r) => r.createdAt <= filters.until!);
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return { ok: true, data: { requests: rows.map((r) => ({ ...r })) } as T };
    }
    case 'purchases.getRequest': {
      const id = String((payload as { id?: string }).id || '');
      const snap = ensurePurchasesMock(organizationId);
      const req = snap.requests.find((r) => r.id === id);
      if (!req) return { ok: false, error: { code: 'NOT_FOUND', message: 'Solicitud de compra' } };
      const items = snap.items.filter((i) => i.purchaseRequestId === id);
      const quotes = snap.quotes
        .filter((q) => q.purchaseRequestId === id)
        .map((q) => ({
          ...q,
          supplierName: snap.suppliers.find((s) => s.id === q.supplierId)?.name ?? '',
        }));
      const decision = snap.decisions.find((d) => d.purchaseRequestId === id);
      return { ok: true, data: { request: { ...req }, items, quotes, decision } as T };
    }
    case 'purchases.createRequest': {
      const body = payload as {
        title?: string;
        description?: string;
        siteId?: string;
        needId?: string;
        requesterId?: string;
        items?: {
          name?: string;
          description?: string;
          quantity?: number;
          unit?: string;
          estimatedCost?: number;
        }[];
      };
      if (!body.title || !body.items?.length) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Faltan campos' },
        };
      }
      const snap = ensurePurchasesMock(organizationId);
      const now = new Date().toISOString();
      const id = nextId();
      const record = {
        id,
        organizationId,
        siteId: body.siteId,
        needId: body.needId,
        title: body.title,
        description: body.description,
        status: 'SUBMITTED',
        requesterId: body.requesterId || 'u-admin',
        createdAt: now,
        updatedAt: now,
        version: 1,
        itemCount: body.items.length,
        quoteCount: 0,
        estimatedTotal: body.items.reduce(
          (acc, it) => acc + (Number(it.estimatedCost) || 0) * (Number(it.quantity) || 0),
          0,
        ),
      };
      snap.requests.push(record as MockPurchaseRequest);
      const items = body.items.map((it) => ({
        id: nextId(),
        organizationId,
        purchaseRequestId: id,
        name: it.name ?? '',
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unit: it.unit ?? 'unidad',
        estimatedCost: it.estimatedCost,
        version: 1,
      }));
      snap.items.push(...(items as MockPurchaseItem[]));
      return { ok: true, data: { request: { ...record }, items } as T };
    }
    case 'purchases.listQuotes': {
      const requestId = String((payload as { purchaseRequestId?: string }).purchaseRequestId || '');
      const snap = ensurePurchasesMock(organizationId);
      const quotes = snap.quotes
        .filter((q) => q.purchaseRequestId === requestId)
        .map((q) => ({
          ...q,
          supplierName: snap.suppliers.find((s) => s.id === q.supplierId)?.name ?? '',
        }));
      return { ok: true, data: { quotes } as T };
    }
    case 'purchases.addQuote': {
      const body = payload as {
        purchaseRequestId?: string;
        supplierId?: string;
        price?: number;
        currency?: string;
        qualityScore?: number;
        deliveryDays?: number;
        warrantyMonths?: number;
        technicalFitScore?: number;
        notes?: string;
      };
      if (!body.purchaseRequestId || !body.supplierId || !(body.price && body.price > 0)) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Faltan campos o precio inválido' },
        };
      }
      const snap = ensurePurchasesMock(organizationId);
      const supplier = snap.suppliers.find((s) => s.id === body.supplierId);
      if (!supplier) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Proveedor' } };
      }
      const now = new Date().toISOString();
      const quote = {
        id: nextId(),
        organizationId,
        purchaseRequestId: body.purchaseRequestId,
        supplierId: body.supplierId,
        price: Number(body.price),
        currency: body.currency || 'ARS',
        qualityScore: Number(body.qualityScore || 0),
        deliveryDays: Number(body.deliveryDays || 0),
        warrantyMonths: Number(body.warrantyMonths || 0),
        technicalFitScore: Number(body.technicalFitScore || 0),
        notes: body.notes,
        status: 'PENDING' as const,
        submittedAt: now,
        version: 1,
        supplierName: supplier.name,
      };
      snap.quotes.push(quote as MockQuote);
      // Bump the request's quoteCount.
      const req = snap.requests.find((r) => r.id === body.purchaseRequestId);
      if (req) {
        req.quoteCount = (req.quoteCount ?? 0) + 1;
        req.version = (req.version ?? 1) + 1;
        req.updatedAt = now;
      }
      return { ok: true, data: { quote } as T };
    }
    case 'purchases.decide': {
      const body = payload as {
        purchaseRequestId?: string;
        chosenQuoteId?: string;
        weights?: Record<string, number>;
        justification?: string;
      };
      if (!body.purchaseRequestId || !body.chosenQuoteId || !body.weights) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Faltan campos' },
        };
      }
      const snap = ensurePurchasesMock(organizationId);
      const request = snap.requests.find((r) => r.id === body.purchaseRequestId);
      if (!request) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Solicitud' } };
      }
      const quotes = snap.quotes.filter((q) => q.purchaseRequestId === body.purchaseRequestId);
      if (!quotes.length) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Sin cotizaciones' },
        };
      }
      const assessment = quotes.map((q) => {
        const supplier = snap.suppliers.find((s) => s.id === q.supplierId);
        return {
          quoteId: q.id,
          price: q.price,
          quality: q.qualityScore,
          delivery: deliveryScore_(q.deliveryDays),
          warranty: warrantyScore_(q.warrantyMonths),
          supplierHistory: supplierHistoryScore_(supplier),
          technicalFit: q.technicalFitScore,
        };
      });
      const scores = scoreMockQuotes(assessment, body.weights as Record<string, number>);
      const justification = body.justification ?? '';
      if (scores[0] && scores[0].quoteId !== body.chosenQuoteId && !justification.trim()) {
        return {
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Justificación obligatoria' },
        };
      }
      const now = new Date().toISOString();
      const decisionId = nextId();
      const decision = {
        id: decisionId,
        organizationId,
        purchaseRequestId: body.purchaseRequestId,
        decidedBy: 'u-admin',
        decidedAt: now,
        chosenQuoteId: body.chosenQuoteId,
        justification,
        weightConfig: body.weights,
        scores,
        version: 1,
      };
      snap.decisions.push(decision as MockDecision);
      request.status = 'APPROVED';
      request.version = (request.version ?? 1) + 1;
      request.updatedAt = now;
      quotes.forEach((q) => {
        q.status = q.id === body.chosenQuoteId ? 'ACCEPTED' : 'REJECTED';
        q.version = (q.version ?? 1) + 1;
        q.submittedAt = q.submittedAt ?? now;
      });
      return {
        ok: true,
        data: { decision, scores, weights: body.weights } as T,
      };
    }
    default:
      return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Mock no soporta ${action}` } };
  }
}
