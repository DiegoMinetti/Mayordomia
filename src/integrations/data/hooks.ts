import { useQuery } from '@tanstack/react-query';
import { useDataClient } from './DataContext';
import type {
  AvailabilityItem,
  AvailabilityResult,
  LocationDto,
  LocationFilters,
  MovementDto,
  OrgDto,
  ReservationDto,
  ReservationFilters,
  ResourceDto,
  ResourceFilters,
  RoleDto,
  SiteDto,
  UserDto,
} from './types';

const KEYS = {
  organization: (orgId: string) => ['catalog', 'organization', orgId] as const,
  sites: (orgId: string) => ['catalog', 'sites', orgId] as const,
  users: (orgId: string) => ['catalog', 'users', orgId] as const,
  roles: (orgId: string) => ['catalog', 'roles', orgId] as const,
  resources: (orgId: string, filters?: ResourceFilters) =>
    ['resources', 'list', orgId, filters ?? {}] as const,
  resource: (orgId: string, id: string) => ['resources', 'detail', orgId, id] as const,
  resourceMovements: (orgId: string, id: string) => ['resources', 'movements', orgId, id] as const,
  locations: (orgId: string, filters?: LocationFilters) =>
    ['locations', 'list', orgId, filters ?? {}] as const,
  location: (orgId: string, id: string) => ['locations', 'detail', orgId, id] as const,
  reservations: (orgId: string, filters?: ReservationFilters) =>
    ['reservations', 'list', orgId, filters ?? {}] as const,
  movements: (orgId: string, resourceId?: string) =>
    ['movements', 'list', orgId, resourceId ?? 'all'] as const,
  availability: (orgId: string, items: AvailabilityItem[]) =>
    ['resources', 'availability', orgId, items] as const,
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

/* -------------------------------------------------------------------------- */
/*  PR 1B — Recursos / Espacios                                              */
/* -------------------------------------------------------------------------- */

export function useResources(filters: ResourceFilters = {}, enabled = true) {
  const client = useDataClient();
  return useQuery<ResourceDto[]>({
    queryKey: [...KEYS.resources('current', filters)],
    enabled,
    queryFn: () => client.listResources(filters),
    staleTime: 30_000,
  });
}

export function useResource(id: string | undefined, enabled = true) {
  const client = useDataClient();
  return useQuery<ResourceDto | null>({
    queryKey: [...KEYS.resource('current', id ?? 'none')],
    enabled: enabled && !!id,
    queryFn: async () => (await client.getResource(id as string)) ?? null,
    staleTime: 30_000,
  });
}

export function useResourceMovements(id: string | undefined, enabled = true) {
  const client = useDataClient();
  return useQuery<MovementDto[]>({
    queryKey: [...KEYS.resourceMovements('current', id ?? 'none')],
    enabled: enabled && !!id,
    queryFn: () => client.listMovements(id, 50),
    staleTime: 30_000,
  });
}

export function useLocations(filters: LocationFilters = {}, enabled = true) {
  const client = useDataClient();
  return useQuery<LocationDto[]>({
    queryKey: [...KEYS.locations('current', filters)],
    enabled,
    queryFn: () => client.listLocations(filters),
    staleTime: 30_000,
  });
}

export function useLocation(id: string | undefined, enabled = true) {
  const client = useDataClient();
  return useQuery<LocationDto | null>({
    queryKey: [...KEYS.location('current', id ?? 'none')],
    enabled: enabled && !!id,
    queryFn: async () => (await client.getLocation(id as string)) ?? null,
    staleTime: 30_000,
  });
}

export function useReservations(filters: ReservationFilters = {}, enabled = true) {
  const client = useDataClient();
  return useQuery<ReservationDto[]>({
    queryKey: [...KEYS.reservations('current', filters)],
    enabled,
    queryFn: () => client.listReservations(filters),
    staleTime: 30_000,
  });
}

export function useMovements(resourceId?: string, enabled = true) {
  const client = useDataClient();
  return useQuery<MovementDto[]>({
    queryKey: [...KEYS.movements('current', resourceId)],
    enabled,
    queryFn: () => client.listMovements(resourceId),
    staleTime: 30_000,
  });
}

export function useAvailability(items: AvailabilityItem[], enabled = true) {
  const client = useDataClient();
  return useQuery<AvailabilityResult>({
    queryKey: [...KEYS.availability('current', items)],
    enabled: enabled && items.length > 0,
    queryFn: () => client.checkAvailability(items),
    staleTime: 15_000,
  });
}
