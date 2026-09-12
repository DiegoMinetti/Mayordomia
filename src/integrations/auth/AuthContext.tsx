import { createContext, ReactNode, useMemo } from 'react';
import type { AuthProvider } from './types';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthProvider | null>(null);

export interface AuthContextProviderProps {
  provider: AuthProvider;
  children: ReactNode;
}

export function AuthContextProvider({ provider, children }: AuthContextProviderProps) {
  // The provider instance is stable; memo the context value to avoid extra renders.
  const value = useMemo(() => provider, [provider]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
