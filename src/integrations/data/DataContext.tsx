import { createContext, ReactNode, useContext, useMemo } from 'react';
import { DataClient } from './DataClient';
import { GatewayClient, type GatewayClientDeps } from './GatewayClient';
import { RequestsDataClient } from './RequestsDataClient';
import { OperationsDataClient } from './OperationsDataClient';
import { MaintenanceDataClient } from './MaintenanceDataClient';
import { PurchasesDataClient } from './PurchasesDataClient';
import { NotificationsDataClient } from './NotificationsDataClient';

export interface DataClients {
  catalog: DataClient;
  requests: RequestsDataClient;
  operations: OperationsDataClient;
  maintenance: MaintenanceDataClient;
  purchases: PurchasesDataClient;
  notifications: NotificationsDataClient;
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
      operations: new OperationsDataClient(gw, { organizationId }),
      maintenance: new MaintenanceDataClient(gw, { organizationId }),
      purchases: new PurchasesDataClient(gw, { organizationId }),
      notifications: new NotificationsDataClient(gw, { organizationId }),
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

export function useOperationsClient(): OperationsDataClient {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useOperationsClient must be used inside <DataProvider>');
  return ctx.operations;
}

export function useMaintenanceClient(): MaintenanceDataClient {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useMaintenanceClient must be used inside <DataProvider>');
  return ctx.maintenance;
}

export function usePurchasesClient(): PurchasesDataClient {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('usePurchasesClient must be used inside <DataProvider>');
  return ctx.purchases;
}

export function useNotificationsClient(): NotificationsDataClient {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useNotificationsClient must be used inside <DataProvider>');
  return ctx.notifications;
}
