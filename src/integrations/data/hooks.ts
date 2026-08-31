import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '../org';
import {
  useDataClient,
  useMaintenanceClient,
  useNotificationsClient,
  useOperationsClient,
  usePurchasesClient,
  useRequestsClient,
} from './DataContext';
import type { DeliveryWithItems } from './OperationsDataClient';
import type { MaintenanceWithUpdates as MaintenanceDetail } from './MaintenanceDataClient';
import type {
  AddQuoteInput,
  AvailabilityItem,
  AvailabilityResult,
  CreateMaintenancePayload,
  CreatePurchaseRequestInput,
  DecidePurchaseInput,
  DeliveryDto,
  DeliveryListFilters,
  DeliverPayload,
  EventDetailDto,
  EventDto,
  EventFilters,
  LocationDto,
  LocationFilters,
  MaintenanceDto,
  MaintenanceListFilters,
  MovementDto,
  NotificationDto,
  NotificationListFilters,
  OrgDto,
  PurchaseRequestDetailDto,
  PurchaseRequestDto,
  PurchaseRequestFilters,
  QuoteDto,
  RequestDecisionPayload,
  RequestDto,
  RequestListFilters,
  ReservationDto,
  ReservationFilters,
  ResourceDto,
  ResourceFilters,
  ReturnDeliveryItemPayload,
  RoleDto,
  SiteDto,
  SupplierDto,
  UpdateMaintenancePayload,
  UpsertSupplierInput,
  UserDto,
} from './types';

const KEYS = {
  organization: (orgId: string) => ['catalog', 'organization', orgId] as const,
  sites: (orgId: string) => ['catalog', 'sites', orgId] as const,
  users: (orgId: string) => ['catalog', 'users', orgId] as const,
  roles: (orgId: string) => ['catalog', 'roles', orgId] as const,
  requestsList: (orgId: string) => ['requests', 'list', orgId] as const,
  request: (orgId: string, id: string) => ['requests', 'detail', orgId, id] as const,
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
  events: (orgId: string, filters: EventFilters) => ['events', 'list', orgId, filters] as const,
  event: (orgId: string, id: string) => ['events', 'get', orgId, id] as const,
  upcoming: (orgId: string, days: number) => ['events', 'upcoming', orgId, days] as const,
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
/*  PR 1A — Solicitudes                                                       */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  PR 1C — Eventos / Agenda                                                 */
/* -------------------------------------------------------------------------- */

export function useEvents(filters: EventFilters = {}, enabled = true) {
  const client = useDataClient();
  return useQuery<EventDto[]>({
    queryKey: [...KEYS.events('current', filters)],
    enabled,
    queryFn: () => client.listEvents(filters),
    staleTime: 30_000,
  });
}

export function useEvent(id: string | undefined, enabled = true) {
  const client = useDataClient();
  return useQuery<EventDetailDto | null>({
    queryKey: [...KEYS.event('current', id ?? '_')],
    enabled: enabled && Boolean(id),
    queryFn: async () => (id ? ((await client.getEvent(id)) ?? null) : null),
    staleTime: 30_000,
  });
}

export function useUpcomingEvents(daysAhead = 14, enabled = true) {
  const client = useDataClient();
  return useQuery<EventDto[]>({
    queryKey: [...KEYS.upcoming('current', daysAhead)],
    enabled,
    queryFn: () => client.upcomingEvents(daysAhead),
    staleTime: 30_000,
  });
}

/* -------------------------------------------------------------------------- */
/*  PR 3a — Operations (Deliveries / Devoluciones)                            */
/* -------------------------------------------------------------------------- */

export function useDeliveries(filters: DeliveryListFilters = {}, enabled = true) {
  const client = useOperationsClient();
  return useQuery<DeliveryDto[]>({
    queryKey: ['operations', 'deliveries', 'current', filters],
    enabled,
    queryFn: () => client.listDeliveries(filters),
    staleTime: 30_000,
  });
}

export function useDelivery(id: string | undefined, enabled = true) {
  const client = useOperationsClient();
  return useQuery<DeliveryWithItems | null>({
    queryKey: ['operations', 'delivery', 'current', id ?? '_'],
    enabled: enabled && Boolean(id),
    queryFn: async () => (id ? ((await client.getDelivery(id)) ?? null) : null),
    staleTime: 30_000,
  });
}

export function useDeliver() {
  const client = useOperationsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeliverPayload) => client.deliver(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations'] }),
  });
}

export function useReturnDeliveryItem() {
  const client = useOperationsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReturnDeliveryItemPayload) => client.returnDeliveryItem(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations'] }),
  });
}

/* -------------------------------------------------------------------------- */
/*  PR 3a — Maintenance                                                      */
/* -------------------------------------------------------------------------- */

export function useMaintenanceList(filters: MaintenanceListFilters = {}, enabled = true) {
  const client = useMaintenanceClient();
  return useQuery<MaintenanceDto[]>({
    queryKey: ['maintenance', 'list', 'current', filters],
    enabled,
    queryFn: () => client.listMaintenance(filters),
    staleTime: 30_000,
  });
}

export function useMaintenance(id: string | undefined, enabled = true) {
  const client = useMaintenanceClient();
  return useQuery<MaintenanceDetail | null>({
    queryKey: ['maintenance', 'detail', 'current', id ?? '_'],
    enabled: enabled && Boolean(id),
    queryFn: async () => (id ? ((await client.getMaintenance(id)) ?? null) : null),
    staleTime: 30_000,
  });
}

export function useCreateMaintenance() {
  const client = useMaintenanceClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMaintenancePayload) => client.createMaintenance(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  });
}

export function useUpdateMaintenance() {
  const client = useMaintenanceClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMaintenancePayload) => client.updateMaintenance(payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      if (vars?.id)
        qc.invalidateQueries({ queryKey: ['maintenance', 'detail', 'current', vars.id] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  PR 3b — Purchases / Compras                                              */
/* -------------------------------------------------------------------------- */

export function usePurchaseRequests(filters: PurchaseRequestFilters = {}, enabled = true) {
  const client = usePurchasesClient();
  return useQuery<PurchaseRequestDto[]>({
    queryKey: ['purchases', 'list', 'current', filters],
    enabled,
    queryFn: () => client.listRequests(filters),
    staleTime: 30_000,
  });
}

export function usePurchaseRequest(id: string | undefined, enabled = true) {
  const client = usePurchasesClient();
  return useQuery<PurchaseRequestDetailDto | null>({
    queryKey: ['purchases', 'detail', 'current', id ?? '_'],
    enabled: enabled && Boolean(id),
    queryFn: async () => (id ? ((await client.getRequest(id)) ?? null) : null),
    staleTime: 30_000,
  });
}

export function useCreatePurchaseRequest() {
  const client = usePurchasesClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchaseRequestInput) => client.createRequest(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  });
}

export function useQuotes(purchaseRequestId: string | undefined, enabled = true) {
  const client = usePurchasesClient();
  return useQuery<QuoteDto[]>({
    queryKey: ['purchases', 'quotes', 'current', purchaseRequestId ?? '_'],
    enabled: enabled && Boolean(purchaseRequestId),
    queryFn: () => client.listQuotes(purchaseRequestId as string),
    staleTime: 30_000,
  });
}

export function useAddQuote() {
  const client = usePurchasesClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddQuoteInput) => client.addQuote(payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['purchases', 'quotes'] });
      if (vars?.purchaseRequestId) {
        qc.invalidateQueries({
          queryKey: ['purchases', 'detail', 'current', vars.purchaseRequestId],
        });
      }
    },
  });
}

export function useDecidePurchase() {
  const client = usePurchasesClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DecidePurchaseInput) => client.decide(payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      if (vars?.purchaseRequestId) {
        qc.invalidateQueries({
          queryKey: ['purchases', 'detail', 'current', vars.purchaseRequestId],
        });
      }
    },
  });
}

export function useSuppliers(enabled = true) {
  const client = usePurchasesClient();
  return useQuery<SupplierDto[]>({
    queryKey: ['purchases', 'suppliers', 'current'],
    enabled,
    queryFn: () => client.listSuppliers(),
    staleTime: 30_000,
  });
}

export function useUpsertSupplier() {
  const client = usePurchasesClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertSupplierInput) => client.upsertSupplier(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases', 'suppliers'] }),
  });
}

/* -------------------------------------------------------------------------- */
/*  PR 3c — Notifications (in-app)                                            */
/* -------------------------------------------------------------------------- */

export const NOTIFICATIONS_QUERY_KEY = ['notifications', 'list', 'current'] as const;
export const UNREAD_COUNT_QUERY_KEY = ['notifications', 'unreadCount', 'current'] as const;

export function useMyNotifications(filters: NotificationListFilters = {}, enabled = true) {
  const client = useNotificationsClient();
  return useQuery<NotificationDto[]>({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, filters],
    enabled,
    queryFn: () => client.listMyNotifications(filters),
    staleTime: 30_000,
  });
}

export function useUnreadCount(options: { pollingInterval?: number; enabled?: boolean } = {}) {
  const client = useNotificationsClient();
  const { enabled = true, pollingInterval = 30_000 } = options;
  return useQuery<number>({
    queryKey: [...UNREAD_COUNT_QUERY_KEY],
    enabled,
    refetchInterval: enabled ? pollingInterval : false,
    queryFn: async () => client.unreadCount(),
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const client = useNotificationsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => client.markRead(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
    },
  });
}

export function useMarkAllRead() {
  const client = useNotificationsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
    },
  });
}
