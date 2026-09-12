import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './GatewayClient';
import { MaintenanceDataClient } from './MaintenanceDataClient';
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

function makeClient(orgId = 'org-1') {
  const gateway = new GatewayClient({
    appsScriptUrl: 'https://example.com/exec',
    getAccessToken: vi.fn().mockResolvedValue('tok'),
  });
  return new MaintenanceDataClient(gateway, { organizationId: orgId });
}

const SAMPLE_MAINTENANCE = {
  id: 'm-1',
  organizationId: 'org-1',
  reportedBy: 'u-1',
  reportedAt: '2026-08-22T10:00:00Z',
  kind: 'CORRECTIVE' as const,
  severity: 'HIGH' as const,
  status: 'OPEN' as const,
  description: 'Cable cortado',
  createdAt: '2026-08-22T10:00:00Z',
  createdBy: 'u-1',
  updatedBy: 'u-1',
  version: 1,
};

describe('MaintenanceDataClient — real fetch path', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('listMaintenance returns the gateway payload', async () => {
    installFetchMock((action) => {
      if (action === 'maintenance.list') {
        return { ok: true, data: { maintenance: [SAMPLE_MAINTENANCE] } };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const list = await client.listMaintenance();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('m-1');
  });

  it('listMaintenance forwards filters to the gateway', async () => {
    const fetchMock = installFetchMock((action) => {
      if (action === 'maintenance.list') {
        return { ok: true, data: { maintenance: [] } };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    await client.listMaintenance({ status: 'OPEN', severity: 'HIGH' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.payload).toMatchObject({ status: 'OPEN', severity: 'HIGH' });
  });

  it('getMaintenance returns the joined detail envelope', async () => {
    installFetchMock((action) => {
      if (action === 'maintenance.get') {
        return {
          ok: true,
          data: {
            maintenance: SAMPLE_MAINTENANCE,
            updates: [
              {
                id: 'u-1',
                organizationId: 'org-1',
                maintenanceId: 'm-1',
                authorId: 'u-1',
                at: '2026-08-22T10:00:00Z',
                kind: 'NOTE',
                text: 'Reporte creado.',
                createdAt: '2026-08-22T10:00:00Z',
                version: 1,
              },
            ],
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const detail = await client.getMaintenance('m-1');
    expect(detail?.maintenance.id).toBe('m-1');
    expect(detail?.updates.length).toBe(1);
  });

  it('createMaintenance posts the payload and returns the new record', async () => {
    installFetchMock((action, payload) => {
      if (action === 'maintenance.create') {
        expect(payload).toMatchObject({
          kind: 'CORRECTIVE',
          severity: 'MEDIUM',
          description: 'Pérdida de señal',
          reportedBy: 'u-1',
        });
        return { ok: true, data: { maintenance: SAMPLE_MAINTENANCE } };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const result = await client.createMaintenance({
      kind: 'CORRECTIVE',
      severity: 'MEDIUM',
      description: 'Pérdida de señal',
      reportedBy: 'u-1',
    });
    expect(result?.id).toBe('m-1');
  });

  it('updateMaintenance posts the patch and returns the new state', async () => {
    installFetchMock((action, payload) => {
      if (action === 'maintenance.update') {
        expect(payload).toMatchObject({ status: 'IN_PROGRESS' });
        return {
          ok: true,
          data: { maintenance: { ...SAMPLE_MAINTENANCE, status: 'IN_PROGRESS' } },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const result = await client.updateMaintenance({
      id: 'm-1',
      expectedVersion: 1,
      status: 'IN_PROGRESS',
      actorId: 'u-1',
    });
    expect(result?.status).toBe('IN_PROGRESS');
  });

  it('returns [] on gateway error for listMaintenance', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'FORBIDDEN', message: 'no' } }));
    const client = makeClient();
    expect(await client.listMaintenance()).toEqual([]);
  });
});

describe('MaintenanceDataClient — mock mode', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('listMaintenance returns deterministic mock rows covering all statuses', async () => {
    const client = new MaintenanceDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    const list = await client.listMaintenance();
    const statuses = new Set(list.map((m) => m.status));
    expect(statuses.has('OPEN')).toBe(true);
    expect(statuses.has('IN_PROGRESS')).toBe(true);
    expect(statuses.has('RESOLVED')).toBe(true);
    expect(statuses.has('CANCELLED')).toBe(true);
  });

  it('getMaintenance returns updates for a known id', async () => {
    const client = new MaintenanceDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    const detail = await client.getMaintenance('mock-mnt-001');
    expect(detail).not.toBeNull();
    expect(detail?.updates.length).toBeGreaterThan(0);
  });

  it('getMaintenance returns null for an unknown id', async () => {
    const client = new MaintenanceDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    expect(await client.getMaintenance('nope')).toBeNull();
  });

  it('updateMaintenance in mock mode advances the version', async () => {
    const client = new MaintenanceDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    const before = await client.getMaintenance('mock-mnt-003');
    const expectedVersion = before!.maintenance.version;
    const result = await client.updateMaintenance({
      id: 'mock-mnt-003',
      expectedVersion,
      status: 'IN_PROGRESS',
      actorId: 'u-1',
    });
    expect(result?.version).toBe(expectedVersion + 1);
    expect(result?.status).toBe('IN_PROGRESS');
  });
});
