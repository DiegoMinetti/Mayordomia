import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataClient } from './DataClient';
import { GatewayClient } from './GatewayClient';
import type { GatewayResponse } from './types';

function installFetchMock(
  responder: (action: string, payload: unknown) => GatewayResponse<unknown>,
) {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => ({
    json: async () => {
      const body = JSON.parse(init.body as string) as { action: string; payload: unknown };
      return responder(body.action, body.payload);
    },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function makeClient() {
  const gateway = new GatewayClient({
    appsScriptUrl: 'https://example.com/exec',
    getAccessToken: vi.fn().mockResolvedValue('tok'),
  });
  return new DataClient(gateway, { organizationId: 'org-1' });
}

describe('DataClient — resources', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('listResources returns the gateway list and scopes by org', async () => {
    installFetchMock((action) => {
      if (action === 'resources.list') {
        return {
          ok: true,
          data: {
            resources: [
              {
                id: 'r1',
                organizationId: 'org-1',
                name: 'Proyector',
                inventoryType: 'SERIALIZED',
                status: 'AVAILABLE',
                quantity: 1,
                unit: 'unidad',
                version: 1,
              },
            ],
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const res = await client.listResources();
    expect(res).toHaveLength(1);
    expect(res[0].organizationId).toBe('org-1');
  });

  it('listResources forwards filters to the gateway', async () => {
    const fetchMock = installFetchMock(() => ({ ok: true, data: { resources: [] } }));
    const client = makeClient();
    await client.listResources({ siteId: 'site-1', status: 'AVAILABLE' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.payload).toEqual({ siteId: 'site-1', status: 'AVAILABLE' });
  });

  it('getResource returns undefined on not found', async () => {
    installFetchMock(() => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' },
    }));
    const client = makeClient();
    expect(await client.getResource('missing')).toBeUndefined();
  });

  it('listLocations returns empty array on error', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'NETWORK', message: 'fail' } }));
    const client = makeClient();
    expect(await client.listLocations()).toEqual([]);
  });

  it('listReservations and listMovements return data when present', async () => {
    installFetchMock((action) => {
      if (action === 'resources.listReservations') {
        return {
          ok: true,
          data: {
            reservations: [
              {
                id: 'resv-1',
                organizationId: 'org-1',
                kind: 'RESOURCE',
                targetId: 'r1',
                requestId: 'req-1',
                startAt: '2026-01-01T10:00:00Z',
                endAt: '2026-01-01T11:00:00Z',
                quantity: 1,
                status: 'CONFIRMED',
                version: 1,
              },
            ],
          },
        };
      }
      if (action === 'resources.listMovements') {
        return {
          ok: true,
          data: {
            movements: [
              {
                id: 'mov-1',
                organizationId: 'org-1',
                resourceId: 'r1',
                type: 'CREATE',
                occurredAt: '2026-01-01T10:00:00Z',
              },
            ],
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    expect(await client.listReservations()).toHaveLength(1);
    expect(await client.listMovements('r1')).toHaveLength(1);
  });

  it('checkAvailability returns the gateway result when ok', async () => {
    installFetchMock(() => ({
      ok: true,
      data: {
        available: { resource: { r1: true }, location: {} },
        conflicts: [],
      },
    }));
    const client = makeClient();
    const result = await client.checkAvailability([
      {
        resourceId: 'r1',
        startAt: '2026-01-01T10:00:00Z',
        endAt: '2026-01-01T11:00:00Z',
        quantity: 1,
      },
    ]);
    expect(result.available.resource.r1).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('checkAvailability returns a safe empty result on error', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'NETWORK', message: 'fail' } }));
    const client = makeClient();
    const result = await client.checkAvailability([
      { resourceId: 'r1', startAt: '2026-01-01T10:00:00Z', endAt: '2026-01-01T11:00:00Z' },
    ]);
    expect(result.available).toEqual({ resource: {}, location: {} });
    expect(result.conflicts).toEqual([]);
  });

  it('mock mode returns deterministic resources without network', async () => {
    const client = new DataClient(
      new GatewayClient({
        appsScriptUrl: 'https://example.com/exec',
        getAccessToken: vi.fn(),
        mock: true,
      }),
      { organizationId: 'org-1' },
    );
    const resources = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
    const types = new Set(resources.map((r) => r.inventoryType));
    expect(types.has('SERIALIZED')).toBe(true);
    expect(types.has('QUANTITY')).toBe(true);

    const location = await client.getLocation('loc-main');
    expect(location?.name).toBe('Salón Principal');
  });
});
