import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleIdentityAuthProvider } from './GoogleIdentityAuthProvider';

interface FakeTokenClient {
  callback: ((response: unknown) => void) | null;
  requestAccessToken: ReturnType<typeof vi.fn>;
}

function installGisMock() {
  const initTokenClient = vi.fn();
  const revoke = vi.fn();
  const tokenClient: FakeTokenClient = {
    callback: null,
    requestAccessToken: vi.fn(),
  };
  initTokenClient.mockReturnValue(tokenClient);
  (window as unknown as { google: unknown }).google = {
    accounts: { oauth2: { initTokenClient, revoke } },
  };
  return { initTokenClient, revoke, tokenClient };
}

describe('GoogleIdentityAuthProvider', () => {
  beforeEach(() => {
    // Avoid loading the real script tag from the network.
    document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((n) => n.remove());
    (window as unknown as { google?: unknown }).google = undefined;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (window as unknown as { google?: unknown }).google = undefined;
  });

  it('reports NOT_CONFIGURED when clientId is empty', async () => {
    const p = new GoogleIdentityAuthProvider({ clientId: '' });
    // microtask for init() to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(p.state.status).toBe('unauthenticated');
    if (p.state.status === 'unauthenticated') {
      expect(p.state.error?.code).toBe('NOT_CONFIGURED');
    }
  });

  it('initializes and reaches unauthenticated when clientId is set', async () => {
    const { initTokenClient } = installGisMock();
    const p = new GoogleIdentityAuthProvider({ clientId: 'test-client' });
    await new Promise((r) => setTimeout(r, 0));
    expect(initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client' }),
    );
    expect(p.state.status).toBe('unauthenticated');
  });

  it('signIn resolves on successful token response and populates user', async () => {
    const { tokenClient } = installGisMock();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sub: 'g-1',
          email: 'real@example.com',
          name: 'Real User',
          picture: 'https://example.com/p.png',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new GoogleIdentityAuthProvider({ clientId: 'cid' });
    await new Promise((r) => setTimeout(r, 0));

    const inFlight = p.signIn();
    // Simulate GIS calling back with a token
    expect(tokenClient.requestAccessToken).toHaveBeenCalled();
    const callback = tokenClient.callback;
    expect(callback).toBeTypeOf('function');
    callback?.({
      access_token: 'tok-1',
      expires_in: 3600,
      scope: 'openid email',
    });
    await inFlight;

    expect(p.state.status).toBe('authenticated');
    if (p.state.status === 'authenticated') {
      expect(p.state.session.user.email).toBe('real@example.com');
      expect(p.state.session.accessToken).toBe('tok-1');
      expect(p.state.session.expiresAt).toBeGreaterThan(Date.now());
    }
    vi.unstubAllGlobals();
  });

  it('signIn rejects with ACCESS_DENIED when the user denies', async () => {
    const { tokenClient } = installGisMock();
    const p = new GoogleIdentityAuthProvider({ clientId: 'cid' });
    await new Promise((r) => setTimeout(r, 0));

    const inFlight = p.signIn();
    const callback = tokenClient.callback;
    callback?.({ error: 'access_denied', error_description: 'denied' });
    await expect(inFlight).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    expect(p.state.status).toBe('unauthenticated');
  });

  it('getValidAccessToken returns the current token and refreshes on expiry', async () => {
    const { tokenClient } = installGisMock();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'g-1', email: 'a@b.c' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const p = new GoogleIdentityAuthProvider({ clientId: 'cid' });
    await new Promise((r) => setTimeout(r, 0));

    const inFlight1 = p.signIn();
    tokenClient.callback?.({ access_token: 'tok-1', expires_in: 3600 });
    await inFlight1;

    const t1 = await p.getValidAccessToken();
    expect(t1).toBe('tok-1');

    // Force expiry by signIn cycle
    const inFlight2 = p.signIn();
    tokenClient.callback?.({ access_token: 'tok-2', expires_in: 3600 });
    await inFlight2;
    const t2 = await p.getValidAccessToken();
    expect(t2).toBe('tok-2');
    vi.unstubAllGlobals();
  });

  it('signOut revokes the token and resets state', async () => {
    const { tokenClient, revoke } = installGisMock();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'g-1', email: 'a@b.c' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const p = new GoogleIdentityAuthProvider({ clientId: 'cid' });
    await new Promise((r) => setTimeout(r, 0));

    const inFlight = p.signIn();
    tokenClient.callback?.({ access_token: 'tok-1', expires_in: 3600 });
    await inFlight;

    await p.signOut();
    expect(revoke).toHaveBeenCalledWith('tok-1', expect.any(Function));
    expect(p.state.status).toBe('unauthenticated');
    vi.unstubAllGlobals();
  });
});
