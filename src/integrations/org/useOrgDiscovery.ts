import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrgClient } from './OrgContext';
import type { ListMineResult, OrganizationSummary } from '../../domain/bootstrap';

const ORG_LIST_KEY = ['org', 'listMine'] as const;

export function useOrgDiscovery(enabled = true) {
  const client = useOrgClient();
  return useQuery<ListMineResult>({
    queryKey: [...ORG_LIST_KEY],
    enabled,
    queryFn: () => client.listMyOrganizations(),
    staleTime: 30_000,
  });
}

export function useOrganizationsList(): OrganizationSummary[] {
  const query = useOrgDiscovery();
  if (!query.data?.ok) return [];
  return query.data.organizations ?? [];
}

export function useInvalidateOrgList() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ORG_LIST_KEY });
}
