import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './GatewayClient';
import { OperationsDataClient } from './OperationsDataClient';
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
  return new OperationsDataClient(gateway, { organizationId: orgId });
}

const SAMPLE_DELIVERY = {
  id: 'd-1',
  organizationId: 'org-1',
  requestId: 'r-1',
  deliveredBy: 'u-1',
  deliveredAt: '2026-08-30T10:00:00Z',
  recipientName: 'Ana',
  status: 'IN_PROGRESS',
  createdAt: '2026-08-30T09:55:00Z',
  createdBy: 'u-1',
  updatedBy: 'u-1',
  version: 1,
};

describe('OperationsDataClient — real fetch path', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('listDeliveries returns the gateway payload', async () => {
    installFetchMock((action) => {
      if (action === 'operations.listDeliveries') {
        return {
          ok: true,
          data: { deliveries: [SAMPLE_DELIVERY] },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const list = await client.listDeliveries();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('d-1');
  });

  it('listDeliveries forwards filters to the gateway', async () => {
    const fetchMock = installFetchMock((action) => {
      if (action === 'operations.listDeliveries') {
        return { ok: true, data: { deliveries: [] } };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    await client.listDeliveries({ status: 'IN_PROGRESS', requestId: 'r-1' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.payload).toMatchObject({ status: 'IN_PROGRESS', requestId: 'r-1' });
  });

  it('getDelivery returns the joined detail envelope', async () => {
    installFetchMock((action) => {
      if (action === 'operations.getDelivery') {
        return {
          ok: true,
          data: {
            delivery: SAMPLE_DELIVERY,
            items: [],
            progress: { totalItems: 0, returnedItems: 0, openItems: 0, damageCount: 0 },
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const detail = await client.getDelivery('d-1');
    expect(detail?.delivery.id).toBe('d-1');
    expect(detail?.progress.totalItems).toBe(0);
  });

  it('deliver posts the payload and returns the result', async () => {
    installFetchMock((action, payload) => {
      if (action === 'operations.deliver') {
        expect(payload).toMatchObject({
          idempotencyKey: 'idem-1',
          requestId: 'r-1',
          recipientName: 'Ana',
        });
        return {
          ok: true,
          data: { delivery: SAMPLE_DELIVERY, items: [], resourceIds: [] },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const result = await client.deliver({
      idempotencyKey: 'idem-1',
      requestId: 'r-1',
      expectedVersion: 1,
      deliveredBy: 'u-1',
      recipientName: 'Ana',
      items: [{ resourceId: 'res-1', quantity: 2 }],
    });
    expect(result?.delivery.id).toBe('d-1');
  });

  it('returnDeliveryItem posts the condition and returns the new state', async () => {
    installFetchMock((action, payload) => {
      if (action === 'operations.returnDeliveryItem') {
        expect(payload).toMatchObject({ condition: 'DAMAGED' });
        return {
          ok: true,
          data: {
            item: { id: 'it-1', deliveryId: 'd-1', resourceId: 'res-1', version: 2 },
            resourceId: 'res-1',
            newStatus: 'BROKEN',
            maintenanceId: 'mnt-1',
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const result = await client.returnDeliveryItem({
      deliveryItemId: 'it-1',
      expectedVersion: 1,
      condition: 'DAMAGED',
      returnedBy: 'u-1',
    });
    expect(result?.newStatus).toBe('BROKEN');
    expect(result?.maintenanceId).toBe('mnt-1');
  });

  it('returns [] on gateway error for listDeliveries', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'FORBIDDEN', message: 'no' } }));
    const client = makeClient();
    expect(await client.listDeliveries()).toEqual([]);
  });

  it('returns null on gateway error for getDelivery', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'NOT_FOUND', message: 'no' } }));
    const client = makeClient();
    expect(await client.getDelivery('missing')).toBeNull();
  });
});

describe('OperationsDataClient — mock mode', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('listDeliveries returns deterministic mock rows', async () => {
    const client = new OperationsDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    const list = await client.listDeliveries();
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((d) => d.status === 'COMPLETED')).toBe(true);
    expect(list.some((d) => d.status === 'IN_PROGRESS')).toBe(true);
  });

  it('getDelivery returns items + progress for a known id', async () => {
    const client = new OperationsDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    const detail = await client.getDelivery('mock-del-001');
    expect(detail).not.toBeNull();
    expect(detail?.items.length).toBeGreaterThan(0);
    expect(detail?.progress.returnedItems).toBeGreaterThan(0);
  });

  it('getDelivery returns null for an unknown id', async () => {
    const client = new OperationsDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    expect(await client.getDelivery('nope')).toBeNull();
  });

  it('returnDeliveryItem with DAMAGED spawns a maintenance record', async () => {
    const client = new OperationsDataClient(
      new GatewayClient({ appsScriptUrl: '', getAccessToken: vi.fn() }),
      { organizationId: 'org-mock' },
    );
    const detail = await client.getDelivery('mock-del-002');
    const openItem = detail?.items.find((it) => !it.returnedAt);
    expect(openItem).toBeDefined();
    const result = await client.returnDeliveryItem({
      deliveryItemId: openItem!.id,
      expectedVersion: openItem!.version,
      condition: 'DAMAGED',
      returnedBy: 'u-1',
      notes: 'Cable cortado',
    });
    expect(result?.newStatus).toBe('BROKEN');
    expect(result?.maintenanceId).toBeDefined();
  });
});
