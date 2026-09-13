/**
 * LocalAuthProvider — email + password auth against the Mayordomía gateway.
 *
 * Replaces GoogleIdentityAuthProvider (PR 4: Sheets/OAuth → SQLite/local-auth).
 * The gateway sets a `mayordomia_session` httpOnly cookie on register/login
 * and exposes /auth/me for verifying the session on page load.
 *
 * Token strategy: we ALSO store the token in sessionStorage so the API client
 * can send `Authorization: Bearer sess_…`. The cookie remains the source of
 * truth for the gateway; sessionStorage is just a convenience for the
 * frontend. (If a user has cookies disabled, the API still works as long as
 * the token is in sessionStorage — the gateway accepts both.)
 */
import type {
  AuthError,
  AuthListener,
  AuthProvider,
  AuthSession,
  AuthState,
  GoogleUser,
} from './types.js';

export interface LocalAuthProviderOptions {
  /** Base URL of the gateway. Defaults to same-origin (`''`). */
  baseUrl?: string;
  /**
   * Optional override for the `fetch` implementation (tests).
   * Defaults to global `fetch`.
   */
  fetchImpl?: typeof fetch;
}

const SESSION_STORAGE_KEY = 'mayordomia_session_token';

export class LocalAuthProvider implements AuthProvider {
  private _state: AuthState = { status: 'loading' };
  private readonly listeners = new Set<AuthListener>();
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: LocalAuthProviderOptions = {}) {
    this.baseUrl = opts.baseUrl ?? '';
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetchImpl) {
      // SSR or stripped fetch — leave state as loading; we'll fail loudly on first request.
      this._state = errorState('NOT_CONFIGURED', 'fetch no disponible');
    }
    void this.bootstrap();
  }

  get state(): AuthState {
    return this._state;
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async signIn(args: { email: string; password: string; organizationId: string }): Promise<void> {
    this.setState({ status: 'loading' });
    try {
      const res = await this.post('/auth/login', args);
      const body = (await res.json()) as ApiEnvelope<{
        token: string;
        expiresAt: string;
        user: ApiUser;
      }>;
      if (!body.ok || !body.data) {
        this.setState({ status: 'unauthenticated', error: toAuthError(body.error) });
        throw new Error(body.error?.message ?? 'login failed');
      }
      const session = toAuthSession(body.data);
      this.persist(session);
      this.setState({ status: 'authenticated', session });
    } catch (err) {
      const error = networkOrUnknown(err);
      this.setState({ status: 'unauthenticated', error });
      throw err;
    }
  }

  async signUp(args: {
    email: string;
    password: string;
    organizationId: string;
    name?: string;
  }): Promise<void> {
    this.setState({ status: 'loading' });
    try {
      const res = await this.post('/auth/register', args);
      const body = (await res.json()) as ApiEnvelope<{
        token: string;
        expiresAt: string;
        user: ApiUser;
      }>;
      if (!body.ok || !body.data) {
        this.setState({ status: 'unauthenticated', error: toAuthError(body.error) });
        throw new Error(body.error?.message ?? 'register failed');
      }
      const session = toAuthSession(body.data);
      this.persist(session);
      this.setState({ status: 'authenticated', session });
    } catch (err) {
      const error = networkOrUnknown(err);
      this.setState({ status: 'unauthenticated', error });
      throw err;
    }
  }

  getUser(): GoogleUser | undefined {
    return this._state.status === 'authenticated' ? this._state.session.user : undefined;
  }

  async signOut(): Promise<void> {
    try {
      await this.post('/auth/logout', {});
    } catch {
      // Best-effort — clear local state regardless.
    }
    this.clear();
    this.setState({ status: 'unauthenticated' });
  }

  async getValidAccessToken(): Promise<string> {
    const current = this._state;
    if (current.status !== 'authenticated') {
      throw new Error('No active session');
    }
    return current.session.accessToken;
  }

  // ---- internals ----------------------------------------------------------

  private async bootstrap(): Promise<void> {
    // Try the cached token first; fall back to /auth/me with the cookie.
    const cached = readTokenFromStorage();
    if (cached) {
      // Best-effort: ask /auth/me to validate.
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/auth/me`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cached}` },
        });
        const body = (await res.json()) as ApiEnvelope<{
          user: ApiUser;
          session: { expiresAt: string };
        }>;
        if (body.ok && body.data) {
          const session = toAuthSession({
            token: cached,
            expiresAt: body.data.session.expiresAt,
            user: body.data.user,
          });
          this.setState({ status: 'authenticated', session });
          return;
        }
      } catch {
        // Network error — keep state as loading; user can try again.
        this.setState({ status: 'unauthenticated' });
        return;
      }
    }
    this.setState({ status: 'unauthenticated' });
  }

  private async post(path: string, payload: unknown): Promise<Response> {
    const token = readTokenFromStorage();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    });
  }

  private setState(state: AuthState): void {
    this._state = state;
    for (const listener of this.listeners) listener(state);
  }

  private persist(session: AuthSession): void {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, session.accessToken);
    } catch {
      // ignore — cookie is still set by the gateway
    }
  }

  private clear(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

// ---- helpers --------------------------------------------------------------

interface ApiUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

function toAuthSession(input: { token: string; expiresAt: string; user: ApiUser }): AuthSession {
  const user: GoogleUser = {
    sub: input.user.id,
    email: input.user.email,
    name: input.user.name,
    picture: '',
  };
  return {
    user,
    accessToken: input.token,
    expiresAt: new Date(input.expiresAt).getTime(),
    scopes: [],
  };
}

function toAuthError(api: { code: string; message: string } | null): AuthError {
  if (!api) return { code: 'UNKNOWN', message: 'Error desconocido' };
  if (api.code === 'UNAUTHORIZED') return { code: 'ACCESS_DENIED', message: api.message };
  if (api.code === 'USER_EXISTS') return { code: 'UNKNOWN', message: api.message };
  if (api.code === 'VALIDATION_ERROR') return { code: 'UNKNOWN', message: api.message };
  return { code: 'UNKNOWN', message: api.message };
}

function networkOrUnknown(err: unknown): AuthError {
  if (err instanceof TypeError) return { code: 'NETWORK', message: err.message };
  return { code: 'UNKNOWN', message: (err as Error).message ?? 'Error desconocido' };
}

function errorState(code: AuthError['code'], message: string): AuthState {
  return { status: 'unauthenticated', error: { code, message } };
}

function readTokenFromStorage(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}
