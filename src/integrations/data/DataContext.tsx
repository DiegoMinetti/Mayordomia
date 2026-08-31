import { createContext, ReactNode, useContext, useMemo } from 'react';
import { DataClient } from './DataClient';
import { GatewayClient, type GatewayClientDeps } from './GatewayClient';

const DataContext = createContext<DataClient | null>(null);
// Exported for tests so they can wrap a fake client without spinning up
// the real provider + deps. The provider remains the public API.
export { DataContext };

export interface DataProviderProps {
  /** Per-organization data client. The provider creates it lazily from deps + org. */
  deps: GatewayClientDeps;
  organizationId: string;
  children: ReactNode;
}

export function DataProvider({ deps, organizationId, children }: DataProviderProps) {
  const client = useMemo(() => {
    const gw = new GatewayClient(deps);
    return new DataClient(gw, { organizationId });
  }, [deps, organizationId]);
  return <DataContext.Provider value={client}>{children}</DataContext.Provider>;
}

export function useDataClient(): DataClient {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataClient must be used inside <DataProvider>');
  return ctx;
}
