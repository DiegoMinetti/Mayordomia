export { AuthContext, AuthContextProvider } from './AuthContext';
export { LocalAuthProvider, ApiCallError } from './LocalAuthProvider';
export type { LocalAuthProviderOptions } from './LocalAuthProvider';
export { MockAuthProvider } from './MockAuthProvider';
export type { MockAuthProviderOptions } from './MockAuthProvider';
export { useAuth, useAuthContextValue } from './useAuth';
export type { UseAuthResult } from './useAuth';
export { DEFAULT_SCOPES, REFRESH_SAFETY_MS } from './types';
export type {
  AuthError,
  AuthListener,
  AuthProvider,
  AuthSession,
  AuthState,
  GoogleUser,
  Scope,
} from './types';

// PR 4 deprecation note: GoogleIdentityAuthProvider is retained only for
// reference and for the unit tests in this same folder. The main app wires
// LocalAuthProvider in src/main.tsx.
export { GoogleIdentityAuthProvider } from './GoogleIdentityAuthProvider';
export type { GoogleIdentityAuthProviderOptions } from './GoogleIdentityAuthProvider';
