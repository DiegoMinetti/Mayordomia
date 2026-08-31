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
    default:
      return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Mock no soporta ${action}` } };
  }
}
