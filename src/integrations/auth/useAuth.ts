import { useCallback, useContext, useSyncExternalStore } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthProvider, GoogleUser, SignInCredentials, SignUpCredentials } from './types';

export function useAuthContextValue(): AuthProvider {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContextValue must be used inside <AuthContextProvider>');
  }
  return ctx;
}

export interface UseAuthResult {
  status: 'loading' | 'unauthenticated' | 'authenticated';
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GoogleUser | undefined;
  error: { code: string; message: string } | undefined;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp?: (credentials: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  /** Returns a valid access token, refreshing silently if needed. */
  getValidAccessToken: () => Promise<string>;
}

export function useAuth(): UseAuthResult {
  const provider = useAuthContextValue();
  const state = useSyncExternalStore(
    (cb) => provider.subscribe(cb),
    () => provider.state,
    () => provider.state,
  );

  const signIn = useCallback(
    (credentials: SignInCredentials) => provider.signIn(credentials),
    [provider],
  );
  const signUp = useCallback(
    (credentials: SignUpCredentials) => {
      if (!provider.signUp) throw new Error('signUp no soportado por este provider');
      return provider.signUp(credentials);
    },
    [provider],
  );
  const signOut = useCallback(() => provider.signOut(), [provider]);
  const getValidAccessToken = useCallback(() => provider.getValidAccessToken(), [provider]);

  return {
    status: state.status,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    user: state.status === 'authenticated' ? state.session.user : undefined,
    error: state.status === 'unauthenticated' ? state.error : undefined,
    signIn,
    signUp: provider.signUp ? signUp : undefined,
    signOut,
    getValidAccessToken,
  };
}
