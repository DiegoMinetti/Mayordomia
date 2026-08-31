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
      return mockDispatch<T>(action, organizationId);
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

function mockDispatch<T>(action: string, organizationId: string): GatewayResponse<T> {
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
    default:
      return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Mock no soporta ${action}` } };
  }
}
