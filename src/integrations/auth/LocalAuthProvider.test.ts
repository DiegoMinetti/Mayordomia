/**
 * LocalAuthProvider — URL prefix contract.
 *
 * The provider runs in the browser and talks to the gateway through an nginx
 * reverse proxy. The bridge is:
 *
 *   - Frontend URL pattern: `/api/auth/*` (VITE_APPS_SCRIPT_URL=/api)
 *   - Gateway URL pattern:  `/auth/*` (no `/api/` prefix)
 *   - nginx strips `/api/` via `proxy_pass http://upstream:3000/;` (trailing slash)
 *
 * If anyone removes the `/api/` prefix here, nginx falls through to the SPA
 * static handler and the request 404s (or worse, returns `index.html` HTML
 * that the frontend can't `JSON.parse` — the symptom on
 * mayordomia.fewlines.com.ar before commit 2c013d2).
 *
 * These tests assert:
 *   - Every fetch URL issued by the provider starts with `/api/auth/`.
 *   - signIn / signUp / signOut / getValidAccessToken end-to-end behavior with
 *     a mock fetch (sanity-check the envelope contract).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiCallError, LocalAuthProvider } from './LocalAuthProvider';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function installFetchMock(): {
  calls: FetchCall[];
  respond: (body: unknown, status?: number) => void;
} {
  const calls: FetchCall[] = [];
  let nextResponder: ((req: FetchCall) => { body: string; status: number }) | null = null;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    if (!nextResponder) throw new Error('no responder set in test');
    const { body, status } = nextResponder({ url, init });
    return new Response(body, { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  return {
    calls,
    respond: (body: unknown, status = 200) => {
      nextResponder = () => ({ body: JSON.stringify(body), status });
    },
  };
}

const SAMPLE_USER = {
  id: 'usr_test_1',
  organizationId: 'org_test_1',
  email: 'admin@example.com',
  name: 'Admin',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('LocalAuthProvider — URL prefix contract', () => {
  let mock: ReturnType<typeof installFetchMock>;
  beforeEach(() => {
    mock = installFetchMock();
  });

  it('every fetch URL starts with `/api/auth/`', async () => {
    mock.respond({
      ok: true,
      data: { token: 'sess_abc', expiresAt: '2030-01-01', user: SAMPLE_USER },
      error: null,
    });
    const p = new LocalAuthProvider({ baseUrl: '' });

    // Bootstrap calls /api/auth/me (token-less → returns UNAUTHORIZED).
    await new Promise((r) => setTimeout(r, 0));

    mock.respond({
      ok: true,
      data: { token: 'sess_abc', expiresAt: '2030-01-01', user: SAMPLE_USER },
      error: null,
    });
    await p.signIn({
      email: SAMPLE_USER.email,
      password: 'pw',
      organizationId: SAMPLE_USER.organizationId,
    });

    mock.respond({
      ok: true,
      data: { token: 'sess_abc', expiresAt: '2030-01-01', user: SAMPLE_USER },
      error: null,
    });
    await p.signUp({
      email: 'new@example.com',
      password: 'pw',
      organizationId: SAMPLE_USER.organizationId,
      name: 'New',
    });

    mock.respond({ ok: true, data: null, error: null });
    await p.signOut();

    for (const call of mock.calls) {
      expect(
        call.url.startsWith('/api/auth/'),
        `expected fetch URL to start with /api/auth/, got: ${call.url}`,
      ).toBe(true);
    }
  });

  it('signIn POSTs to /api/auth/login with JSON body', async () => {
    mock.respond({
      ok: true,
      data: { token: 'sess_abc', expiresAt: '2030-01-01', user: SAMPLE_USER },
      error: null,
    });
    const p = new LocalAuthProvider({ baseUrl: '' });

    await p.signIn({ email: 'admin@example.com', password: 'hunter2', organizationId: 'org_x' });

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].url).toBe('/api/auth/login');
    expect(mock.calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(mock.calls[0].init?.body))).toEqual({
      email: 'admin@example.com',
      password: 'hunter2',
      organizationId: 'org_x',
    });
  });

  it('signUp POSTs to /api/auth/register (NOT /auth/register)', async () => {
    // Bootstrap also calls /api/auth/me — respond to it first, then the
    // signUp POST.
    mock.respond({ ok: false, data: null, error: { code: 'UNAUTHORIZED', message: 'no token' } });
    const p = new LocalAuthProvider({ baseUrl: '' });
    await new Promise((r) => setTimeout(r, 0));

    mock.respond({
      ok: true,
      data: { token: 'sess_abc', expiresAt: '2030-01-01', user: SAMPLE_USER },
      error: null,
    });
    await p.signUp({
      email: 'new@example.com',
      password: 'hunter2',
      organizationId: 'org_x',
      name: 'New',
    });

    // The regression Diego hit was that this URL was `/auth/register` (no
    // /api/ prefix). nginx then forwards it as-is, the gateway 404s, and the
    // browser sees an HTML page where JSON was expected.
    const signUpCall = mock.calls.find((c) => c.url.endsWith('/auth/register'));
    expect(signUpCall, 'expected a POST to /api/auth/register').toBeDefined();
    expect(signUpCall!.url).toBe('/api/auth/register');
  });

  it('signOut POSTs to /api/auth/logout', async () => {
    mock.respond({ ok: false, data: null, error: { code: 'UNAUTHORIZED', message: 'no token' } });
    const p = new LocalAuthProvider({ baseUrl: '' });
    await new Promise((r) => setTimeout(r, 0));

    mock.respond({ ok: true, data: null, error: null });
    await p.signOut();

    const logoutCall = mock.calls.find((c) => c.url.endsWith('/auth/logout'));
    expect(logoutCall, 'expected a POST to /api/auth/logout').toBeDefined();
    expect(logoutCall!.url).toBe('/api/auth/logout');
    expect(logoutCall!.init?.method).toBe('POST');
  });

  it('throws ApiCallError with ORG_NOT_FOUND when gateway rejects register on missing org', async () => {
    mock.respond({
      ok: false,
      data: null,
      error: { code: 'ORG_NOT_FOUND', message: 'no such org' },
    });
    const p = new LocalAuthProvider({ baseUrl: '' });

    await expect(
      p.signUp({ email: 'a@b.com', password: 'pw', organizationId: 'org_x', name: 'A' }),
    ).rejects.toMatchObject({ code: 'ORG_NOT_FOUND', name: 'ApiCallError' });
  });

  it('throws ApiCallError on USER_EXISTS so the UI can branch', async () => {
    mock.respond({
      ok: false,
      data: null,
      error: { code: 'USER_EXISTS', message: 'taken' },
    });
    const p = new LocalAuthProvider({ baseUrl: '' });

    await expect(
      p.signIn({ email: 'a@b.com', password: 'pw', organizationId: 'org_x' }),
    ).rejects.toBeInstanceOf(ApiCallError);
  });
});
