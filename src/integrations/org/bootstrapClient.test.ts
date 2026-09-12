import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BootstrapClient } from './bootstrapClient';
import type { BootstrapFormValues } from '../../domain/bootstrap';

const validForm: BootstrapFormValues = {
  organizationName: 'Demo',
  timezone: 'America/Argentina/Buenos_Aires',
  siteName: 'Sede Centro',
  siteAddress: 'Calle 1',
  acceptTerms: true,
};

describe('BootstrapClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns NOT_CONFIGURED when no URL is set', async () => {
    const client = new BootstrapClient({
      appsScriptUrl: '',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const res = await client.bootstrapOrganization(validForm);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error?.code).toBe('NOT_CONFIGURED');
  });

  it('returns UNAUTHORIZED when getAccessToken throws', async () => {
    const client = new BootstrapClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockRejectedValue(new Error('not authed')),
    });
    const res = await client.bootstrapOrganization(validForm);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error?.code).toBe('UNAUTHORIZED');
  });

  it('POSTs the right envelope and returns descriptor on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: true,
          data: {
            descriptor: {
              organizationId: 'org-1',
              name: 'Demo',
              rootFolderId: 'f-1',
              databaseFileId: 'db-1',
              schemaVersion: 1,
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new BootstrapClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok-1'),
    });
    const res = await client.bootstrapOrganization(validForm);
    expect(res.ok).toBe(true);
    expect(res.descriptor?.organizationId).toBe('org-1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/exec');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.action).toBe('bootstrap.organization');
    expect(body.auth.accessToken).toBe('tok-1');
    expect(body.payload.organizationName).toBe('Demo');
    expect(body.payload.siteName).toBe('Sede Centro');
    vi.unstubAllGlobals();
  });

  it('returns gateway error when envelope is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'No access' },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new BootstrapClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const res = await client.bootstrapOrganization(validForm);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error?.code).toBe('FORBIDDEN');
    vi.unstubAllGlobals();
  });

  it('returns NETWORK on non-JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.reject(new Error('not json')),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new BootstrapClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const res = await client.bootstrapOrganization(validForm);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error?.code).toBe('NETWORK');
    vi.unstubAllGlobals();
  });

  it('mock mode skips the network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new BootstrapClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn(),
      mock: true,
    });
    const res = await client.bootstrapOrganization(validForm);
    expect(res.ok).toBe(true);
    expect(res.descriptor?.name).toBe('Demo');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('listMyOrganizations hits org.listMine and returns the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: true,
          data: {
            organizations: [
              {
                organizationId: 'org-1',
                name: 'One',
                rootFolderId: 'f-1',
                databaseFileId: 'db-1',
                schemaVersion: 1,
                isOwner: true,
              },
            ],
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new BootstrapClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    });
    const res = await client.listMyOrganizations();
    expect(res.ok).toBe(true);
    expect(res.organizations).toHaveLength(1);
    expect(res.organizations?.[0].organizationId).toBe('org-1');
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.action).toBe('org.listMine');
    vi.unstubAllGlobals();
  });
});
