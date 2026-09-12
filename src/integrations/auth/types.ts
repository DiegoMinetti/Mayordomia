/**
 * Auth contracts for Mayordomía.
 *
 * The app never talks to Google directly — it always goes through an AuthProvider
 * implementation. The default implementation (GoogleIdentityAuthProvider) wraps
 * Google Identity Services. A MockAuthProvider exists for tests and offline dev.
 *
 * Access tokens are short-lived (1h). The provider refreshes automatically when
 * `getValidAccessToken()` is called and the cached token is near expiry. The
 * consumer never has to think about refresh logic.
 */

export interface GoogleUser {
  /** Stable Google user id (subject claim from the ID token). */
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface AuthSession {
  user: GoogleUser;
  /** Bearer token to send to the Apps Script gateway and Google APIs. */
  accessToken: string;
  /** Epoch ms. The provider refreshes proactively when within the safety window. */
  expiresAt: number;
  /** Scopes actually granted (subset of the requested scopes). */
  scopes: string[];
}

export type AuthError =
  | { code: 'NOT_CONFIGURED'; message: string }
  | { code: 'POPUP_CLOSED'; message: string }
  | { code: 'ACCESS_DENIED'; message: string }
  | { code: 'NETWORK'; message: string }
  | { code: 'EXPIRED'; message: string }
  | { code: 'UNKNOWN'; message: string };

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated'; error?: AuthError }
  | { status: 'authenticated'; session: AuthSession };

export type AuthListener = (state: AuthState) => void;

export interface AuthProvider {
  readonly state: AuthState;
  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Used by `useAuth()` via `useSyncExternalStore`.
   */
  subscribe(listener: AuthListener): () => void;
  /**
   * Open the Google OAuth popup. Resolves once the user is authenticated.
   * Rejects with an `AuthError` if the user denies or something fails.
   */
  signIn(): Promise<void>;
  /** Revoke the token and clear local state. Safe to call when already signed out. */
  signOut(): Promise<void>;
  /**
   * Return a valid access token, refreshing silently if expired.
   * Throws if not authenticated.
   */
  getValidAccessToken(): Promise<string>;
  /** Convenience for the UI: get the cached user when authenticated. */
  getUser(): GoogleUser | undefined;
}

/**
 * Default scopes for Mayordomía.
 *
 * - `openid` + userinfo: identity (required for any sign-in).
 * - `drive.appdata`: store the organization descriptor in the hidden appDataFolder.
 * - `drive.file`: read/write files created by the app (Sheets DB, attachments).
 * - `spreadsheets`: read/write the Mayordomia DB spreadsheet.
 * - `calendar.events` + `calendar.readonly`: optional, used only when Calendar sync
 *   is enabled by the admin. Keeping them in the default request avoids a second
 *   OAuth round-trip; the user can decline them in the consent screen.
 */
export const DEFAULT_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

export type Scope = (typeof DEFAULT_SCOPES)[number];

/** Refresh this many ms before actual expiry to avoid races. */
export const REFRESH_SAFETY_MS = 60_000;
