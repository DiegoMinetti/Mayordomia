import { createContext, ReactNode, useContext, useMemo } from 'react';
import { BootstrapClient } from './bootstrapClient';
import type { BootstrapClientDeps } from './bootstrapClient';

const OrgContext = createContext<BootstrapClient | null>(null);

export interface OrgProviderProps {
  client: BootstrapClient;
  children: ReactNode;
}

export function OrgProvider({ client, children }: OrgProviderProps) {
  // The client is a stable instance; memo to avoid extra renders.
  const value = useMemo(() => client, [client]);
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrgClient(): BootstrapClient {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrgClient must be used inside <OrgProvider>');
  return ctx;
}

export function createBootstrapClient(deps: BootstrapClientDeps): BootstrapClient {
  return new BootstrapClient(deps);
}
