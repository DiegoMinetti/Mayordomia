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

export type EventKind = 'SERVICE' | 'REHEARSAL' | 'CLASS' | 'MEETING' | 'OTHER';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
export type EventResponsibility = 'LEAD' | 'SUPPORT' | 'INFO';
export type EventPeopleRole = 'LEAD' | 'SUPPORT' | 'ATTENDEE';

export interface EventDto {
  id: string;
  organizationId: string;
  siteId?: string;
  name: string;
  description?: string;
  kind: EventKind;
  startAt: string;
  endAt: string;
  allDay: boolean;
  recurrenceRule?: string;
  parentEventId?: string;
  status: EventStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface EventAreaDto {
  id: string;
  organizationId: string;
  eventId: string;
  areaId: string;
  responsibility: EventResponsibility;
}

export interface EventResourceDto {
  id: string;
  organizationId: string;
  eventId: string;
  resourceId: string;
  quantity: number;
}

export interface EventPersonDto {
  id: string;
  organizationId: string;
  eventId: string;
  personId: string;
  role: EventPeopleRole;
}

export interface EventTemplateDto {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  defaultAreas?: string[];
  defaultResources?: Record<string, number>;
}

export interface EventDetailDto extends EventDto {
  areas: EventAreaDto[];
  resources: EventResourceDto[];
  people: EventPersonDto[];
  template?: EventTemplateDto;
}

export interface EventFilters {
  siteId?: string;
  status?: EventStatus;
  kind?: EventKind;
  startAfter?: string;
  endBefore?: string;
}

/**
 * DTOs for the requests catalog.
 *
 * Mirrors the JSON shape returned by `apps-script/Requests.gs` so the
 * frontend can render and operate on requests without re-deriving fields.
 * These are intentionally separate from the domain types in
 * `src/domain/request.ts`; the domain module is responsible for the
 * mapping/conversion.
 */
export type RequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PENDING_AREA_APPROVAL'
  | 'PENDING_GENERAL_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'DELIVERED'
  | 'CANCELLED';

export type RequestType =
  | 'RESOURCE'
  | 'LOCATION'
  | 'AUDIO'
  | 'MULTIMEDIA'
  | 'LIGHTING'
  | 'SUPPORT'
  | 'MAINTENANCE'
  | 'PURCHASE'
  | 'OTHER';

export type RequestSource = 'PUBLIC_QR' | 'INTERNAL' | 'ADMIN' | 'IMPORTED';

export type ApprovalScope = 'AREA' | 'GENERAL';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RequestApprovalDto {
  id: string;
  requestId: string;
  scope: ApprovalScope;
  areaId?: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  comment?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface RequestTimelineEventDto {
  at: string;
  kind: 'CREATED' | 'APPROVED' | 'REJECTED' | 'STATUS_CHANGED';
  actor: string;
  label: string;
  scope?: ApprovalScope;
  areaId?: string;
  comment?: string;
}

export type ApprovalRollup = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RequestFlagsDto {
  needsAreaApproval: boolean;
  needsGeneralApproval: boolean;
}

export interface RequestDto {
  id: string;
  organizationId: string;
  siteId?: string;
  type: RequestType;
  kind?: string;
  requesterName: string;
  requesterEmail?: string;
  description: string;
  requestedFor?: string;
  source: RequestSource;
  status: RequestStatus;
  eventStart?: string;
  eventEnd?: string;
  urgencyReason?: string;
  lateReason?: string;
  currentArea?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
  approvalSummary?: { area: ApprovalRollup; general: ApprovalRollup };
  needsAreaApproval?: boolean;
  needsGeneralApproval?: boolean;
  approvals?: RequestApprovalDto[];
  timeline?: RequestTimelineEventDto[];
  flags?: RequestFlagsDto;
}

export interface RequestListFilters {
  status?: RequestStatus;
  type?: RequestType;
  siteId?: string;
  since?: string;
  until?: string;
}

export interface RequestDecisionPayload {
  id: string;
  scope: ApprovalScope;
  expectedVersion: number;
  comment?: string;
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
