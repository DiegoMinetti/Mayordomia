export { GatewayClient } from './GatewayClient';
export type { GatewayClientDeps } from './GatewayClient';
export { DataClient } from './DataClient';
export { DataProvider, useDataClient, DataContext } from './DataContext';
export {
  useOrganization,
  useSites,
  useUsers,
  useRoles,
  useResources,
  useResource,
  useResourceMovements,
  useLocations,
  useLocation,
  useReservations,
  useMovements,
  useAvailability,
} from './hooks';
export type {
  OrgDto,
  SiteDto,
  UserDto,
  RoleDto,
  ResourceDto,
  ResourceFilters,
  ResourceInventoryType,
  ResourceStatusDto,
  LocationDto,
  LocationFilters,
  ReservationDto,
  ReservationFilters,
  ReservationKind,
  ReservationStatusDto,
  MovementDto,
  MovementType,
  AvailabilityItem,
  AvailabilityResult,
  AvailabilityConflict,
  GatewayEnvelope,
  GatewayError,
  GatewayResponse,
} from './types';
