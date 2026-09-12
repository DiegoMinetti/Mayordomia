import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './GatewayClient';
import { RequestsDataClient } from './RequestsDataClient';

function installFetchMock(responder: (action: string, payload: unknown) => unknown) {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { action: string; payload: unknown };
    return { json: async () => responder(body.action, body.payload) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const orgId = 'org-1';

describe('RequestsDataClient (real fetch path)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listRequests returns the gateway payload', async () => {
    installFetchMock((action, payload) => {
      expect(action).toBe('requests.list');
      expect((payload as { status?: string }).status).toBe('PENDING');
      return {
        ok: true,
        data: {
          requests: [
            { id: 'r1', type: 'AUDIO', status: 'PENDING', version: 1, createdAt: '2026-08-20' },
          ],
        },
      };
    });
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: 'https://example.com/exec',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const list = await client.listRequests({ status: 'PENDING' });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('r1');
  });

  it('getRequest returns null when the gateway replies with not found', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'NOT_FOUND', message: 'Solicitud' } }));
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: 'https://example.com/exec',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const result = await client.getRequest('missing');
    expect(result).toBeNull();
  });

  it('approveRequest posts the decision and returns id + version', async () => {
    installFetchMock((action, payload) => {
      expect(action).toBe('requests.approve');
      const body = payload as {
        id: string;
        scope: string;
        expectedVersion: number;
        comment?: string;
      };
      expect(body).toEqual({ id: 'r1', scope: 'AREA', expectedVersion: 3, comment: 'ok' });
      return { ok: true, data: { id: 'r1', status: 'APPROVED', version: 4 } };
    });
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: 'https://example.com/exec',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const result = await client.approveRequest({
      id: 'r1',
      scope: 'AREA',
      expectedVersion: 3,
      comment: 'ok',
    });
    expect(result).toEqual({ id: 'r1', version: 4, status: 'APPROVED' });
  });

  it('rejectRequest forwards the payload unchanged', async () => {
    installFetchMock((action, payload) => {
      expect(action).toBe('requests.reject');
      expect(payload).toEqual({ id: 'r1', scope: 'GENERAL', expectedVersion: 2 });
      return { ok: true, data: { id: 'r1', status: 'REJECTED', version: 3 } };
    });
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: 'https://example.com/exec',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const result = await client.rejectRequest({ id: 'r1', scope: 'GENERAL', expectedVersion: 2 });
    expect(result?.status).toBe('REJECTED');
  });

  it('returns [] when listRequests gets an error envelope', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'FORBIDDEN', message: 'no' } }));
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: 'https://example.com/exec',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    expect(await client.listRequests()).toEqual([]);
  });
});

describe('RequestsDataClient (mock mode)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listRequests returns deterministic mock rows', async () => {
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: '',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const list = await client.listRequests();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => typeof r.id === 'string')).toBe(true);
  });

  it('getRequest returns approvals + timeline for a known id', async () => {
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: '',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const result = await client.getRequest('mock-req-0003');
    expect(result).not.toBeNull();
    expect(result?.approvals?.length).toBe(2);
    expect(result?.timeline?.length).toBeGreaterThan(0);
  });

  it('getRequest returns null for an unknown id', async () => {
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: '',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    expect(await client.getRequest('nope')).toBeNull();
  });

  it('approveRequest in mock mode advances version and status', async () => {
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: '',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const before = await client.getRequest('mock-req-0001');
    expect(before?.version).toBe(1);
    const result = await client.approveRequest({
      id: 'mock-req-0001',
      scope: 'AREA',
      expectedVersion: 1,
    });
    expect(result?.version).toBe(2);
    const after = await client.getRequest('mock-req-0001');
    expect(after?.status).toBe('APPROVED');
  });

  it('approveRequest with a stale expectedVersion returns null', async () => {
    const client = new RequestsDataClient(
      new GatewayClient({
        appsScriptUrl: '',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const result = await client.approveRequest({
      id: 'mock-req-0001',
      scope: 'AREA',
      expectedVersion: 99,
    });
    expect(result).toBeNull();
  });
});
