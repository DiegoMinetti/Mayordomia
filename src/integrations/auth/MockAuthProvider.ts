/**
 * MockAuthProvider — deterministic, in-memory provider for tests and offline dev.
 *
 * Configure with `signInMode: 'auto' | 'manual'` to skip the popup in tests.
 */

import { AuthListener, AuthProvider, AuthState, GoogleUser } from './types';

export interface MockAuthProviderOptions {
  user?: GoogleUser;
  signInMode?: 'auto' | 'manual';
  initialState?: AuthState;
  expiresInMs?: number;
}

export class MockAuthProvider implements AuthProvider {
  private _state: AuthState;
  private readonly listeners = new Set<AuthListener>();
  private readonly user: GoogleUser | undefined;
  private readonly signInMode: 'auto' | 'manual';
  private readonly expiresInMs: number;

  constructor(opts: MockAuthProviderOptions = {}) {
    this.user = opts.user;
    this.signInMode = opts.signInMode ?? 'manual';
    this.expiresInMs = opts.expiresInMs ?? 3600_000;
    this._state = opts.initialState ?? { status: 'unauthenticated' };
    if (this.signInMode === 'auto' && this.user) {
      this._state = this.makeAuthed();
    }
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

  async signIn(): Promise<void> {
    if (!this.user) {
      throw new Error('MockAuthProvider has no user configured');
    }
    this._state = this.makeAuthed();
    this.emit();
  }

  async signOut(): Promise<void> {
    this._state = { status: 'unauthenticated' };
    this.emit();
  }

  async getValidAccessToken(): Promise<string> {
    if (this._state.status !== 'authenticated') {
      throw new Error('Not authenticated');
    }
    return this._state.session.accessToken;
  }

  getUser(): GoogleUser | undefined {
    return this._state.status === 'authenticated' ? this._state.session.user : undefined;
  }

  private makeAuthed(): AuthState {
    if (!this.user) throw new Error('no user');
    return {
      status: 'authenticated',
      session: {
        user: this.user,
        accessToken: 'mock-access-token',
        expiresAt: Date.now() + this.expiresInMs,
        scopes: [],
      },
    };
  }

  private emit(): void {
    for (const l of this.listeners) l(this._state);
  }
}
