import { useQuery } from '@tanstack/react-query';
import { useDataClient } from './DataContext';
import type { OrgDto, RoleDto, SiteDto, UserDto } from './types';

const KEYS = {
  organization: (orgId: string) => ['catalog', 'organization', orgId] as const,
  sites: (orgId: string) => ['catalog', 'sites', orgId] as const,
  users: (orgId: string) => ['catalog', 'users', orgId] as const,
  roles: (orgId: string) => ['catalog', 'roles', orgId] as const,
};

export function useOrganization(enabled = true) {
  const client = useDataClient();
  return useQuery<OrgDto | null>({
    queryKey: [...KEYS.organization('current')],
    enabled,
    queryFn: async () => (await client.getOrganization()) ?? null,
    staleTime: 60_000,
  });
}

export function useSites(enabled = true) {
  const client = useDataClient();
  return useQuery<SiteDto[]>({
    queryKey: [...KEYS.sites('current')],
    enabled,
    queryFn: () => client.listSites(),
    staleTime: 60_000,
  });
}

export function useUsers(enabled = true) {
  const client = useDataClient();
  return useQuery<UserDto[]>({
    queryKey: [...KEYS.users('current')],
    enabled,
    queryFn: () => client.listUsers(),
    staleTime: 60_000,
  });
}

export function useRoles(enabled = true) {
  const client = useDataClient();
  return useQuery<RoleDto[]>({
    queryKey: [...KEYS.roles('current')],
    enabled,
    queryFn: () => client.listRoles(),
    staleTime: 60_000,
  });
}
