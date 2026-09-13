/**
 * LoginDialog — URL prefix contract for inline fetches.
 *
 * The dialog uses LocalAuthProvider for `signIn` / `signUp` (covered by
 * LocalAuthProvider.test.ts), but three paths bypass the provider and call
 * `fetch` directly:
 *
 *   - POST /api/auth/magic-link        (send a magic-link to the user's email)
 *   - POST /api/auth/magic-link/verify (consume the token from the email)
 *   - POST /api/auth/setup             (bootstrap a new org + admin)
 *
 * Each of these MUST use the `/api/` prefix. The first version of this file
 * (commit e242772) didn't — the magic-link paths were `/auth/magic-link`
 * (no prefix), and nginx's SPA fallback returned `index.html` (HTTP 200 with
 * HTML body) instead of forwarding the request. The fix landed in dd535d2.
 *
 * This test guards against that drift coming back.
 *
 * Implementation note: MUI v7's TextField does not expose a stable `id` to
 * associate the visible `<label>` with the `<input>` by default. We work
 * around it by querying inputs via `getByLabelText` with the `selector`
 * option (CSS attribute match on the input's `aria-label`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginDialog } from './LoginDialog';
import { AuthContext, AuthContextProvider, ApiCallError } from '../../integrations/auth';
import type { AuthProvider } from '../../integrations/auth';

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function installFetchRecorder(): {
  calls: FetchCall[];
  respondNext: (body: unknown, status?: number) => void;
} {
  const calls: FetchCall[] = [];
  let next: { body: string; status: number } | null = null;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    if (!next) throw new Error('no responder set in test');
    const { body, status } = next;
    return new Response(body, { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return {
    calls,
    respondNext: (body: unknown, status = 200) => {
      next = { body: JSON.stringify(body), status };
    },
  };
}

function mockAuthProvider(impl: Partial<AuthProvider>): AuthProvider {
  return {
    state: { status: 'unauthenticated' },
    subscribe: () => () => undefined,
    signIn: vi.fn(async () => undefined),
    signUp: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    getValidAccessToken: vi.fn(async () => 'sess_test'),
    getUser: () => undefined,
    ...impl,
  } as AuthProvider;
}

function renderDialog(provider: AuthProvider, props: { defaultOrganizationId?: string } = {}) {
  return render(
    <AuthContext.Provider value={provider}>
      <AuthContextProvider provider={provider}>
        <LoginDialog open onClose={() => undefined} {...props} />
      </AuthContextProvider>
    </AuthContext.Provider>,
  );
}

describe('LoginDialog — inline fetch URLs use /api/auth/ prefix', () => {
  let mock: ReturnType<typeof installFetchRecorder>;
  beforeEach(() => {
    mock = installFetchRecorder();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('magic-link send POSTs to /api/auth/magic-link', async () => {
    mock.respondNext({ ok: true, data: { expiresAt: '2030-01-01', ttlMs: 900_000 } });
    renderDialog(mockAuthProvider({}));

    // Switch to magic-link tab.
    fireEvent.click(screen.getByRole('tab', { name: 'Magic link' }));
    // MUI's required labels render as "Email *", so use a regex matcher.
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/ID de organizaci/i), {
      target: { value: 'org_x' },
    });
    // Submit.
    fireEvent.click(screen.getByRole('button', { name: /Enviar enlace/i }));

    await waitFor(() => {
      expect(mock.calls.length).toBeGreaterThan(0);
    });
    const magicCall = mock.calls.find((c) => c.url.includes('magic-link'));
    expect(magicCall, 'expected a fetch to magic-link endpoint').toBeDefined();
    expect(magicCall!.url).toBe('/api/auth/magic-link');
    expect(magicCall!.url.startsWith('/api/auth/')).toBe(true);
    expect(magicCall!.init?.method).toBe('POST');
  });

  it('magic-link verify POSTs to /api/auth/magic-link/verify', async () => {
    // First call: send magic-link (sets magicSent=true → reveals token field).
    mock.respondNext({ ok: true, data: { expiresAt: '2030-01-01', ttlMs: 900_000 } });
    renderDialog(mockAuthProvider({}));

    fireEvent.click(screen.getByRole('tab', { name: 'Magic link' }));
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/ID de organizaci/i), { target: { value: 'org_x' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar enlace/i }));

    // Wait until the token field appears, then change the responder.
    await waitFor(() => {
      expect(screen.getByLabelText(/Token de magic link/i)).toBeInTheDocument();
    });

    mock.respondNext({
      ok: true,
      data: { token: 'sess_x', expiresAt: '2030-01-01', userId: 'u', organizationId: 'org_x' },
    });
    fireEvent.change(screen.getByLabelText(/Token de magic link/i), {
      target: { value: 'tok_abc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verificar enlace/i }));

    await waitFor(() => {
      const verifyCall = mock.calls.find((c) => c.url.includes('magic-link/verify'));
      expect(verifyCall).toBeDefined();
    });
    const verifyCall = mock.calls.find((c) => c.url.includes('magic-link/verify'));
    expect(verifyCall!.url).toBe('/api/auth/magic-link/verify');
  });

  it('bootstrap button POSTs to /api/auth/setup when signUp returns ORG_NOT_FOUND', async () => {
    const provider = mockAuthProvider({
      signUp: vi.fn(async () => {
        throw new ApiCallError('ORG_NOT_FOUND', 'no such org');
      }),
    });
    mock.respondNext({
      ok: true,
      data: { token: 'sess_x', expiresAt: '2030-01-01', userId: 'u', organizationId: 'org_x' },
    });

    renderDialog(provider, { defaultOrganizationId: 'org_x' });

    // Switch to register mode in the password tab.
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta nueva/i }));
    // Fill the form.
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'pw12345678' } });
    fireEvent.change(screen.getByLabelText(/^Nombre/i), { target: { value: 'Admin' } });
    // Submit — should fail with ORG_NOT_FOUND and reveal the bootstrap button.
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Crear congregación/i })).toBeInTheDocument();
    });

    // Click bootstrap.
    fireEvent.click(screen.getByRole('button', { name: /Crear congregación/i }));

    await waitFor(() => {
      expect(mock.calls.length).toBeGreaterThan(0);
    });
    const setupCall = mock.calls.find((c) => c.url.includes('/auth/setup'));
    expect(setupCall, 'expected a fetch to /api/auth/setup').toBeDefined();
    expect(setupCall!.url).toBe('/api/auth/setup');
    expect(setupCall!.init?.method).toBe('POST');
  });
});
