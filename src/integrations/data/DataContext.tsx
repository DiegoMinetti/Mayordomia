import { createContext, ReactNode, useContext, useMemo } from 'react';
import { DataClient } from './DataClient';
import { GatewayClient, type GatewayClientDeps } from './GatewayClient';
import { RequestsDataClient } from './RequestsDataClient';

export interface DataClients {
  catalog: DataClient;
  requests: RequestsDataClient;
}

/** Exposed for tests so they can wrap a fake client. Prefer the hooks. */
const DataContext = createContext<DataClients | null>(null);
export { DataContext };

export interface DataProviderProps {
  /** Per-organization data clients. The provider creates them lazily from deps + org. */
  deps: GatewayClientDeps;
  organizationId: string;
  children: ReactNode;
}

export function DataProvider({ deps, organizationId, children }: DataProviderProps) {
  const clients = useMemo<DataClients>(() => {
    const gw = new GatewayClient(deps);
    return {
      catalog: new DataClient(gw, { organizationId }),
      requests: new RequestsDataClient(gw, { organizationId }),
    };
  }, [deps, organizationId]);
  return <DataContext.Provider value={clients}>{children}</DataContext.Provider>;
}

export function useDataClient(): DataClient {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataClient must be used inside <DataProvider>');
  return ctx.catalog;
}

export function useRequestsClient(): RequestsDataClient {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useRequestsClient must be used inside <DataProvider>');
  return ctx.requests;
}
