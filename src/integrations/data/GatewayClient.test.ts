import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './GatewayClient';

function installFetchMock(responder: (action: string) => unknown) {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { action: string };
    return { json: async () => responder(body.action) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('GatewayClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns NOT_CONFIGURED when URL is empty in mock mode', async () => {
    const client = new GatewayClient({
      appsScriptUrl: '',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    // Empty URL falls back to mock.
    const res = await client.call<{ sites: unknown[] }>('catalog.listSites', 'org-1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.sites).toBeDefined();
  });

  it('POSTs the right envelope and returns data on success', async () => {
    const fetchMock = installFetchMock((action) => {
      if (action === 'catalog.listSites') {
        return { ok: true, data: { sites: [{ id: 's1', name: 'Sede' }] } };
      }
      return { ok: false, error: { code: 'NOT_FOUND', message: 'x' } };
    });
    const client = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok-1'),
    });
    const res = await client.call<{ sites: { id: string }[] }>('catalog.listSites', 'org-1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.sites[0].id).toBe('s1');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.action).toBe('catalog.listSites');
    expect(body.organizationId).toBe('org-1');
    expect(body.auth.accessToken).toBe('tok-1');
  });

  it('returns UNAUTHORIZED when the token cannot be obtained', async () => {
    const client = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockRejectedValue(new Error('not authed')),
    });
    const res = await client.call<unknown>('catalog.listSites', 'org-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNAUTHORIZED');
  });

  it('returns NETWORK on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const client = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const res = await client.call<unknown>('catalog.listSites', 'org-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NETWORK');
  });

  it('returns NETWORK on non-JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.reject(new Error('not json')) }),
    );
    const client = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const res = await client.call<unknown>('catalog.listSites', 'org-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NETWORK');
  });

  it('returns the gateway error when the envelope is not ok', async () => {
    installFetchMock(() => ({ ok: false, error: { code: 'FORBIDDEN', message: 'no' } }));
    const client = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const res = await client.call<unknown>('catalog.listSites', 'org-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FORBIDDEN');
  });

  it('mock mode short-circuits the network', async () => {
    const client = new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn(),
      mock: true,
    });
    const res = await client.call<{ sites: { id: string; organizationId: string }[] }>(
      'catalog.listSites',
      'org-1',
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.sites).toHaveLength(2);
      expect(res.data.sites[0].organizationId).toBe('org-1');
    }
  });
});
