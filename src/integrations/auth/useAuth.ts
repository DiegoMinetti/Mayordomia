import { useCallback, useContext, useSyncExternalStore } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthProvider, GoogleUser } from './types';

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
  signIn: () => Promise<void>;
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

  const signIn = useCallback(() => provider.signIn(), [provider]);
  const signOut = useCallback(() => provider.signOut(), [provider]);
  const getValidAccessToken = useCallback(() => provider.getValidAccessToken(), [provider]);

  return {
    status: state.status,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    user: state.status === 'authenticated' ? state.session.user : undefined,
    error: state.status === 'unauthenticated' ? state.error : undefined,
    signIn,
    signOut,
    getValidAccessToken,
  };
}
