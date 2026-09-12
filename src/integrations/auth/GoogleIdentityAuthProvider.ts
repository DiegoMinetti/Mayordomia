/**
 * GoogleIdentityAuthProvider — Google Identity Services (GIS) implementation.
 *
 * This provider does NOT store any tokens in localStorage or IndexedDB. The
 * access token lives only in memory (this class instance). The refresh
 * happens via GIS's silent request when the token is near expiry; if the
 * user revoked the session, GIS will pop a new consent flow.
 *
 * The script tag for GIS is loaded on first use and cached by the browser.
 * In tests, `window.google.accounts.oauth2` is mocked.
 */

import {
  AuthError,
  AuthListener,
  AuthProvider,
  AuthState,
  DEFAULT_SCOPES,
  GoogleUser,
  REFRESH_SAFETY_MS,
} from './types';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GisTokenClient {
  callback: ((response: TokenResponse) => void) | null;
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GisGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }) => GisTokenClient;
      revoke: (accessToken: string, done?: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GisGlobal;
  }
}

export interface GoogleIdentityAuthProviderOptions {
  clientId: string;
  scopes?: readonly string[];
  /** Override the GIS script URL (for tests or self-hosted proxies). */
  gisSrc?: string;
}

export class GoogleIdentityAuthProvider implements AuthProvider {
  private _state: AuthState = { status: 'loading' };
  private readonly listeners = new Set<AuthListener>();
  private tokenClient: GisTokenClient | null = null;
  private readonly clientId: string;
  private readonly scopes: readonly string[];
  private readonly gisSrc: string;
  private user: GoogleUser | undefined;

  constructor(opts: GoogleIdentityAuthProviderOptions) {
    this.clientId = opts.clientId;
    this.scopes = opts.scopes ?? DEFAULT_SCOPES;
    this.gisSrc = opts.gisSrc ?? GIS_SRC;
    void this.init();
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

  getUser(): GoogleUser | undefined {
    return this.user;
  }

  async signIn(): Promise<void> {
    if (!this.tokenClient) {
      throw new Error('GoogleIdentityAuthProvider not initialized yet');
    }
    return new Promise<void>((resolve, reject) => {
      this.tokenClient!.callback = async (response) => {
        if (response.error) {
          const err = mapGisError(response);
          this.setState({ status: 'unauthenticated', error: err });
          reject(err);
          return;
        }
        if (!response.access_token) {
          const err: AuthError = { code: 'UNKNOWN', message: 'No access token in response' };
          this.setState({ status: 'unauthenticated', error: err });
          reject(err);
          return;
        }
        try {
          const user = await this.fetchUserInfo(response.access_token);
          this.user = user;
          const expiresInMs = (response.expires_in ?? 3600) * 1000;
          this.setState({
            status: 'authenticated',
            session: {
              user,
              accessToken: response.access_token,
              expiresAt: Date.now() + expiresInMs - REFRESH_SAFETY_MS,
              scopes: response.scope ? response.scope.split(' ') : [...this.scopes],
            },
          });
          resolve();
        } catch {
          const err: AuthError = { code: 'NETWORK', message: 'Failed to fetch user info' };
          this.setState({ status: 'unauthenticated', error: err });
          reject(err);
        }
      };
      this.tokenClient!.requestAccessToken();
    });
  }

  async signOut(): Promise<void> {
    if (this._state.status === 'authenticated') {
      const token = this._state.session.accessToken;
      try {
        window.google?.accounts.oauth2.revoke(token, () => undefined);
      } catch {
        // ignore — revoke is best-effort
      }
    }
    this.user = undefined;
    this.setState({ status: 'unauthenticated' });
  }

  async getValidAccessToken(): Promise<string> {
    if (this._state.status !== 'authenticated') {
      throw new Error('Not authenticated');
    }
    const { accessToken, expiresAt } = this._state.session;
    if (Date.now() < expiresAt) {
      return accessToken;
    }
    // Expired (or about to be). Re-run the OAuth flow. GIS will skip the
    // consent screen if the user still has a valid grant.
    await this.signIn();
    if (this._state.status !== 'authenticated') {
      throw new Error('Failed to refresh access token');
    }
    return this._state.session.accessToken;
  }

  private setState(next: AuthState): void {
    this._state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private async init(): Promise<void> {
    if (!this.clientId) {
      this.setState({
        status: 'unauthenticated',
        error: {
          code: 'NOT_CONFIGURED',
          message: 'VITE_GOOGLE_CLIENT_ID is not set. Configure it in .env.local.',
        },
      });
      return;
    }
    try {
      await this.loadGis();
      this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: this.scopes.join(' '),
        callback: () => undefined,
      });
      this.setState({ status: 'unauthenticated' });
    } catch {
      this.setState({
        status: 'unauthenticated',
        error: { code: 'NETWORK', message: 'Failed to load Google Identity Services' },
      });
    }
  }

  private loadGis(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('No window'));
        return;
      }
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[src="${this.gisSrc}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('GIS script load error')), {
          once: true,
        });
        return;
      }
      const script = document.createElement('script');
      script.src = this.gisSrc;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('GIS script load error'));
      document.head.appendChild(script);
    });
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleUser> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`userinfo ${res.status}`);
    }
    const data = (await res.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };
    if (!data.sub || !data.email) {
      throw new Error('userinfo missing required fields');
    }
    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  }
}

function mapGisError(response: TokenResponse): AuthError {
  const desc = response.error_description ?? response.error ?? 'unknown';
  if (response.error === 'access_denied') {
    return { code: 'ACCESS_DENIED', message: desc };
  }
  if (response.error === 'popup_closed' || response.error === 'window_closed') {
    return { code: 'POPUP_CLOSED', message: desc };
  }
  return { code: 'UNKNOWN', message: desc };
}
