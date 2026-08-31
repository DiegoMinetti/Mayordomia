import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '../org';
import { useDataClient, useRequestsClient } from './DataContext';
import type {
  OrgDto,
  RequestDecisionPayload,
  RequestDto,
  RequestListFilters,
  RoleDto,
  SiteDto,
  UserDto,
} from './types';

const KEYS = {
  organization: (orgId: string) => ['catalog', 'organization', orgId] as const,
  sites: (orgId: string) => ['catalog', 'sites', orgId] as const,
  users: (orgId: string) => ['catalog', 'users', orgId] as const,
  roles: (orgId: string) => ['catalog', 'roles', orgId] as const,
  requestsList: (orgId: string) => ['requests', 'list', orgId] as const,
  request: (orgId: string, id: string) => ['requests', 'detail', orgId, id] as const,
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

export function useRequests(filters: RequestListFilters = {}, enabled = true) {
  const client = useRequestsClient();
  const { organizationId } = useCurrentOrg();
  return useQuery<RequestDto[]>({
    queryKey: [...KEYS.requestsList(organizationId ?? 'current'), filters],
    enabled: enabled && !!organizationId,
    queryFn: () => client.listRequests(filters),
    staleTime: 30_000,
  });
}

export function useRequest(id: string | undefined, enabled = true) {
  const client = useRequestsClient();
  const { organizationId } = useCurrentOrg();
  return useQuery<RequestDto | null>({
    queryKey: [...KEYS.request(organizationId ?? 'current', id ?? 'none')],
    enabled: enabled && !!id && !!organizationId,
    queryFn: async () => (id ? ((await client.getRequest(id)) ?? null) : null),
    staleTime: 30_000,
  });
}

export function useApproveRequest() {
  const client = useRequestsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestDecisionPayload) => client.approveRequest(payload),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['requests'] });
      if (data?.id) void qc.invalidateQueries({ queryKey: ['requests', 'detail'] });
    },
  });
}

export function useRejectRequest() {
  const client = useRequestsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestDecisionPayload) => client.rejectRequest(payload),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['requests'] });
      if (data?.id) void qc.invalidateQueries({ queryKey: ['requests', 'detail'] });
    },
  });
}
