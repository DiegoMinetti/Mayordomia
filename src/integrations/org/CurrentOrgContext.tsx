import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useOrgDiscovery } from './useOrgDiscovery';

const STORAGE_KEY = 'mayordomia.currentOrgId';

export interface CurrentOrgState {
  organizationId: string | undefined;
  setOrganizationId: (id: string) => void;
  /** True when discovery is done and we have a usable org (or none yet). */
  ready: boolean;
  /** All orgs the user can pick from. */
  available: { organizationId: string; name: string; isOwner: boolean }[];
}

const CurrentOrgContext = createContext<CurrentOrgState | null>(null);

export interface CurrentOrgProviderProps {
  children: ReactNode;
}

export function CurrentOrgProvider({ children }: CurrentOrgProviderProps) {
  const discovery = useOrgDiscovery();
  const orgs = useMemo(
    () => (discovery.data?.ok && discovery.data.organizations) || [],
    [discovery.data],
  );

  const [override, setOverride] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  });

  const fallback = orgs[0]?.organizationId;
  const organizationId =
    override && orgs.some((o) => o.organizationId === override) ? override : fallback;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (organizationId) window.localStorage.setItem(STORAGE_KEY, organizationId);
  }, [organizationId]);

  const setOrganizationId = useCallback((id: string) => setOverride(id), []);

  const value = useMemo<CurrentOrgState>(
    () => ({
      organizationId,
      setOrganizationId,
      ready: !discovery.isLoading,
      available: orgs,
    }),
    [organizationId, setOrganizationId, discovery.isLoading, orgs],
  );
  return <CurrentOrgContext.Provider value={value}>{children}</CurrentOrgContext.Provider>;
}

export function useCurrentOrg(): CurrentOrgState {
  const ctx = useContext(CurrentOrgContext);
  if (!ctx) throw new Error('useCurrentOrg must be used inside <CurrentOrgProvider>');
  return ctx;
}
