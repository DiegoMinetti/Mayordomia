/**
 * DTOs for the catalog endpoints.
 *
 * These mirror the JSON shape returned by the Apps Script gateway so the
 * frontend can stay loosely coupled to the schema. Future write paths can
 * extend these with the optimistic-concurrency fields required by
 * `VersionedRepository` in `src/repositories/contracts.ts`.
 */

export interface OrgDto {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteDto {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  active: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserDto {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  picture?: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  version: number;
}

export interface RoleDto {
  id: string;
  organizationId: string;
  name: string;
  permissionIds: string[];
  version: number;
}

/* -------------------------------------------------------------------------- */
/*  PR 1B — Recursos / Espacios                                              */
/* -------------------------------------------------------------------------- */

export type ResourceInventoryType = 'SERIALIZED' | 'QUANTITY';
export type ResourceStatusDto =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'DELIVERED'
  | 'IN_USE'
  | 'RETURN_PENDING'
  | 'MAINTENANCE'
  | 'BROKEN'
  | 'MISSING'
  | 'RETIRED';

export interface ResourceDto {
  id: string;
  organizationId: string;
  siteId?: string;
  areaId?: string;
  locationId?: string;
  categoryId?: string;
  name: string;
  description?: string;
  inventoryType: ResourceInventoryType;
  status: ResourceStatusDto;
  quantity: number;
  unit: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  internalCode?: string;
  photo?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  supplierId?: string;
  warrantyUntil?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  version: number;
}

export interface LocationDto {
  id: string;
  organizationId: string;
  siteId?: string;
  name: string;
  description?: string;
  capacity?: number;
  rules?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  version: number;
}

export type ReservationKind = 'RESOURCE' | 'LOCATION';
export type ReservationStatusDto = 'PENDING_RESERVATION' | 'CONFIRMED' | 'CANCELLED';

export interface ReservationDto {
  id: string;
  organizationId: string;
  kind: ReservationKind;
  targetId: string;
  requestId: string;
  startAt: string;
  endAt: string;
  quantity: number;
  status: ReservationStatusDto;
  createdAt?: string;
  updatedAt?: string;
  version: number;
}

export type MovementType =
  'CREATE' | 'MOVE' | 'RESERVE' | 'DELIVER' | 'RETURN' | 'MAINTAIN' | 'RETIRE' | 'ADJUST';

export interface MovementDto {
  id: string;
  organizationId: string;
  resourceId: string;
  type: MovementType;
  fromLocationId?: string;
  toLocationId?: string;
  fromStatus?: ResourceStatusDto;
  toStatus?: ResourceStatusDto;
  quantity?: number;
  actorId?: string;
  reason?: string;
  occurredAt: string;
}

export interface AvailabilityItem {
  resourceId?: string;
  locationId?: string;
  startAt: string;
  endAt: string;
  quantity?: number;
}

export interface AvailabilityConflict {
  code:
    | 'INVALID_INTERVAL'
    | 'UNAVAILABLE_RESOURCE'
    | 'SERIALIZED_OVERLAP'
    | 'INSUFFICIENT_QUANTITY'
    | 'LOCATION_OVERLAP'
    | 'NOT_FOUND';
  resourceId?: string;
  locationId?: string;
  reservationIds?: string[];
  available?: number;
  wanted?: number;
  target?: 'resource' | 'location';
  item?: AvailabilityItem;
}

export interface AvailabilityResult {
  available: { resource: Record<string, boolean>; location: Record<string, boolean> };
  conflicts: AvailabilityConflict[];
}

export interface ResourceFilters {
  siteId?: string;
  areaId?: string;
  status?: ResourceStatusDto;
  kind?: ResourceInventoryType;
}

export interface LocationFilters {
  siteId?: string;
  active?: boolean;
}

export interface ReservationFilters {
  targetId?: string;
  kind?: ReservationKind;
  status?: ReservationStatusDto;
  startAfter?: string;
  endBefore?: string;
}

export interface GatewayEnvelope<T> {
  ok: true;
  data: T;
  error?: null;
}

export interface GatewayError {
  ok: false;
  error: { code: string; message: string };
  data?: null;
}

export type GatewayResponse<T> = GatewayEnvelope<T> | GatewayError;
