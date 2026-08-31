import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './GatewayClient';
import { PurchasesDataClient } from './PurchasesDataClient';
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
  return new PurchasesDataClient(
    new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    }),
    { organizationId: 'org-1' },
  );
}

describe('PurchasesDataClient (real fetch path)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('listRequests forwards filters to the gateway', async () => {
    const fetchMock = installFetchMock((action) => {
      if (action === 'purchases.listRequests') {
        return {
          ok: true,
          data: {
            requests: [
              {
                id: 'pr-1',
                organizationId: 'org-1',
                title: 'Cables',
                status: 'SUBMITTED',
                createdAt: '2026-08-22T10:00:00Z',
                version: 1,
                itemCount: 1,
                quoteCount: 0,
                estimatedTotal: 1000,
              },
            ],
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const list = await client.listRequests({ status: 'SUBMITTED' });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('pr-1');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.action).toBe('purchases.listRequests');
    expect(body.payload).toEqual({ status: 'SUBMITTED' });
  });

  it('getRequest returns null when the gateway replies with NOT_FOUND', async () => {
    installFetchMock(() => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Solicitud de compra' },
    }));
    const client = makeClient();
    expect(await client.getRequest('missing')).toBeNull();
  });

  it('getRequest returns the detail payload on success', async () => {
    installFetchMock(() => ({
      ok: true,
      data: {
        request: {
          id: 'pr-1',
          organizationId: 'org-1',
          title: 'Cables',
          status: 'SUBMITTED',
          createdAt: '2026-08-22T10:00:00Z',
          version: 1,
        },
        items: [
          {
            id: 'i1',
            organizationId: 'org-1',
            purchaseRequestId: 'pr-1',
            name: 'XLR',
            quantity: 6,
            unit: 'unidad',
            version: 1,
          },
        ],
        quotes: [],
      },
    }));
    const client = makeClient();
    const detail = await client.getRequest('pr-1');
    expect(detail?.items).toHaveLength(1);
    expect(detail?.request.id).toBe('pr-1');
  });

  it('addQuote posts the payload and returns the new quote', async () => {
    const fetchMock = installFetchMock((action, payload) => {
      if (action === 'purchases.addQuote') {
        const body = payload as Record<string, unknown>;
        expect(body.purchaseRequestId).toBe('pr-1');
        expect(body.supplierId).toBe('sup-1');
        expect(body.price).toBe(50000);
        return {
          ok: true,
          data: {
            quote: {
              id: 'q-new',
              organizationId: 'org-1',
              purchaseRequestId: 'pr-1',
              supplierId: 'sup-1',
              supplierName: 'Sonido SA',
              price: 50000,
              currency: 'ARS',
              qualityScore: 80,
              deliveryDays: 5,
              warrantyMonths: 12,
              technicalFitScore: 75,
              status: 'PENDING',
              version: 1,
            },
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const quote = await client.addQuote({
      purchaseRequestId: 'pr-1',
      supplierId: 'sup-1',
      price: 50000,
      currency: 'ARS',
      qualityScore: 80,
      deliveryDays: 5,
      warrantyMonths: 12,
      technicalFitScore: 75,
    });
    expect(quote?.id).toBe('q-new');
    expect(quote?.supplierName).toBe('Sonido SA');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('decide posts weights + chosenQuoteId and returns the scores + decision', async () => {
    const fetchMock = installFetchMock((action, payload) => {
      if (action === 'purchases.decide') {
        const body = payload as Record<string, unknown>;
        expect(body.chosenQuoteId).toBe('q-1');
        expect(body.weights).toEqual({
          price: 30,
          quality: 25,
          delivery: 15,
          warranty: 10,
          supplierHistory: 10,
          technicalFit: 10,
        });
        return {
          ok: true,
          data: {
            decision: {
              id: 'pd-1',
              organizationId: 'org-1',
              purchaseRequestId: 'pr-1',
              decidedBy: 'u-admin',
              decidedAt: '2026-08-22T10:00:00Z',
              chosenQuoteId: 'q-1',
              version: 1,
            },
            scores: [
              { quoteId: 'q-1', score: 80, breakdown: {} },
              { quoteId: 'q-2', score: 60, breakdown: {} },
            ],
            weights: body.weights,
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const result = await client.decide({
      purchaseRequestId: 'pr-1',
      chosenQuoteId: 'q-1',
      weights: {
        price: 30,
        quality: 25,
        delivery: 15,
        warranty: 10,
        supplierHistory: 10,
        technicalFit: 10,
      },
    });
    expect(result?.scores).toHaveLength(2);
    expect(result?.decision.chosenQuoteId).toBe('q-1');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('listSuppliers / upsertSupplier round-trip', async () => {
    installFetchMock((action) => {
      if (action === 'purchases.listSuppliers') {
        return {
          ok: true,
          data: {
            suppliers: [
              {
                id: 'sup-1',
                organizationId: 'org-1',
                name: 'Sonido SA',
                active: true,
                rating: 4.5,
                version: 1,
              },
            ],
          },
        };
      }
      if (action === 'purchases.upsertSupplier') {
        return {
          ok: true,
          data: {
            supplier: {
              id: 'sup-2',
              organizationId: 'org-1',
              name: 'Muebles',
              active: true,
              version: 1,
            },
          },
        };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = makeClient();
    const list = await client.listSuppliers();
    expect(list).toHaveLength(1);
    const created = await client.upsertSupplier({ name: 'Muebles' });
    expect(created?.id).toBe('sup-2');
  });

  it('returns safe empty arrays on gateway errors', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'NETWORK', message: 'fail' } }));
    const client = makeClient();
    expect(await client.listRequests()).toEqual([]);
    expect(await client.listQuotes('pr-1')).toEqual([]);
    expect(await client.listSuppliers()).toEqual([]);
    expect(await client.createRequest({ title: 'x', items: [] })).toBeNull();
  });
});

describe('PurchasesDataClient (mock mode)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('exposes a deterministic seeded dataset', async () => {
    const client = new PurchasesDataClient(
      new GatewayClient({
        appsScriptUrl: '',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: 'org-1' },
    );
    const list = await client.listRequests();
    expect(list.length).toBeGreaterThanOrEqual(3);
    const detail = await client.getRequest('pr-0002');
    expect(detail?.quotes.length).toBe(3);
    expect(detail?.decision).toBeDefined();
    const suppliers = await client.listSuppliers();
    expect(suppliers.length).toBeGreaterThanOrEqual(3);
  });

  it('decide() against mock data updates the request status and quote statuses', async () => {
    const client = new PurchasesDataClient(
      new GatewayClient({
        appsScriptUrl: '',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: 'org-1' },
    );
    const before = await client.getRequest('pr-0003');
    expect(before?.request.status).toBe('SUBMITTED');
    const result = await client.decide({
      purchaseRequestId: 'pr-0003',
      chosenQuoteId: 'q-0003-a',
      weights: {
        price: 30,
        quality: 25,
        delivery: 15,
        warranty: 10,
        supplierHistory: 10,
        technicalFit: 10,
      },
    });
    expect(result?.decision.chosenQuoteId).toBe('q-0003-a');
    const after = await client.getRequest('pr-0003');
    expect(after?.request.status).toBe('APPROVED');
    const accepted = after?.quotes.find((q) => q.id === 'q-0003-a');
    expect(accepted?.status).toBe('ACCEPTED');
  });
});
