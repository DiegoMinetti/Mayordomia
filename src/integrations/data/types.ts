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

/* -------------------------------------------------------------------------- */
/*  PR 3a — Operations (Deliveries / Devoluciones)                           */
/* -------------------------------------------------------------------------- */

export type DeliveryStatusDto = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ReturnConditionDto = 'OK' | 'DAMAGED' | 'LOST';

export interface DeliveryDto {
  id: string;
  organizationId: string;
  requestId: string;
  deliveredBy: string;
  deliveredAt: string;
  siteId?: string;
  recipientName: string;
  notes?: string;
  status: DeliveryStatusDto;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface DeliveryItemDto {
  id: string;
  organizationId: string;
  deliveryId: string;
  resourceId: string;
  resourceName?: string;
  quantity: number;
  returnedAt?: string;
  returnedBy?: string;
  returnNotes?: string;
  returnedQuantity?: number;
  condition?: ReturnConditionDto;
  version: number;
}

export interface DeliveryListFilters {
  status?: DeliveryStatusDto;
  requestId?: string;
  since?: string;
  until?: string;
}

export interface DeliverPayload {
  idempotencyKey: string;
  requestId: string;
  expectedVersion: number;
  deliveredBy: string;
  deliveredAt?: string;
  siteId?: string;
  recipientName: string;
  notes?: string;
  items: Array<{ resourceId: string; quantity: number }>;
}

export interface ReturnDeliveryItemPayload {
  deliveryItemId: string;
  expectedVersion: number;
  condition: ReturnConditionDto;
  returnedBy: string;
  returnedAt?: string;
  returnedQuantity?: number;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/*  PR 3a — Maintenance                                                       */
/* -------------------------------------------------------------------------- */

export type MaintenanceKindDto = 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION';
export type MaintenanceSeverityDto = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceStatusDto = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export type MaintenanceUpdateKindDto = 'NOTE' | 'STATUS' | 'COST' | 'RESOLUTION';

export interface MaintenanceUpdateDto {
  id: string;
  organizationId: string;
  maintenanceId: string;
  authorId: string;
  at: string;
  kind: MaintenanceUpdateKindDto;
  text: string;
  createdAt: string;
  version: number;
}

export interface MaintenanceDto {
  id: string;
  organizationId: string;
  siteId?: string;
  resourceId?: string;
  reportedBy: string;
  reportedAt: string;
  kind: MaintenanceKindDto;
  severity: MaintenanceSeverityDto;
  status: MaintenanceStatusDto;
  description: string;
  resolution?: string;
  cost?: number;
  supplierId?: string;
  startedAt?: string;
  resolvedAt?: string;
  sourceDeliveryItemId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface MaintenanceListFilters {
  status?: MaintenanceStatusDto;
  kind?: MaintenanceKindDto;
  severity?: MaintenanceSeverityDto;
  resourceId?: string;
  siteId?: string;
}

export interface CreateMaintenancePayload {
  resourceId?: string;
  siteId?: string;
  kind: MaintenanceKindDto;
  severity: MaintenanceSeverityDto;
  description: string;
  reportedBy: string;
  sourceDeliveryItemId?: string;
}

export interface UpdateMaintenancePayload {
  id: string;
  expectedVersion: number;
  status?: MaintenanceStatusDto;
  resolution?: string;
  cost?: number;
  note?: string;
  actorId: string;
}

/* -------------------------------------------------------------------------- */
/*  Ola 3b — Compras / Proveedores                                            */
/* -------------------------------------------------------------------------- */

export type PurchaseStatus =
  'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface PurchaseRequestItemDto {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  version: number;
}

export interface PurchaseRequestDto {
  id: string;
  organizationId: string;
  siteId?: string;
  needId?: string;
  title: string;
  description: string;
  status: PurchaseStatus;
  requesterId: string;
  items?: PurchaseRequestItemDto[];
  itemCount: number;
  quoteCount: number;
  estimatedTotal?: number;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface PurchaseRequestDetailDto {
  request: PurchaseRequestDto;
  items: PurchaseRequestItemDto[];
  quotes: QuoteDto[];
  decision?: PurchaseDecisionDto;
}

export interface PurchaseRequestFilters {
  status?: PurchaseStatus;
  requesterId?: string;
  since?: string;
  until?: string;
}

export interface CreatePurchaseItemInput {
  name: string;
  description?: string;
  quantity: number;
  unit?: string;
  estimatedCost?: number;
}

export interface CreatePurchaseRequestInput {
  title: string;
  description?: string;
  siteId?: string;
  needId?: string;
  requesterId?: string;
  items: CreatePurchaseItemInput[];
}

export interface QuoteDto {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  supplierId: string;
  supplierName?: string;
  price: number;
  currency: string;
  qualityScore: number;
  deliveryDays: number;
  warrantyMonths: number;
  technicalFitScore: number;
  notes?: string;
  status: QuoteStatus;
  submittedAt: string;
  version: number;
}

export interface AddQuoteInput {
  purchaseRequestId: string;
  supplierId: string;
  price: number;
  currency: string;
  qualityScore: number;
  deliveryDays: number;
  warrantyMonths: number;
  technicalFitScore: number;
  notes?: string;
}

export interface PurchaseWeightsDto {
  price: number;
  quality: number;
  delivery: number;
  warranty: number;
  supplierHistory: number;
  technicalFit: number;
}

export interface ScoreBreakdownEntry {
  dimension: 'price' | 'quality' | 'delivery' | 'warranty' | 'supplierHistory' | 'technicalFit';
  label: string;
  raw: number;
  weight: number;
  contribution: number;
}

export interface QuoteScoreDto {
  quoteId: string;
  score: number;
  breakdown: Record<keyof PurchaseWeightsDto, ScoreBreakdownEntry>;
}

export interface DecidePurchaseInput {
  purchaseRequestId: string;
  chosenQuoteId: string;
  weights: PurchaseWeightsDto;
  justification?: string;
}

export interface DecidePurchaseResult {
  decision: PurchaseDecisionDto;
  scores: QuoteScoreDto[];
  weights: PurchaseWeightsDto;
}

export interface PurchaseDecisionDto {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  decidedBy: string;
  decidedAt: string;
  chosenQuoteId: string;
  justification?: string;
  weightConfig?: PurchaseWeightsDto | null;
  scores?: string;
  version: number;
}

export interface SupplierDto {
  id: string;
  organizationId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  rating: number;
  active: boolean;
  version: number;
}

export interface UpsertSupplierInput {
  id?: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  rating?: number;
  active?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  PR 3C — Notifications (in-app)                                            */
/* -------------------------------------------------------------------------- */

export type NotificationKind =
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'MAINTENANCE_OPENED'
  | 'DELIVERY_CREATED'
  | 'RETURN_DAMAGED'
  | 'PURCHASE_DECISION'
  | 'EVENT_REMINDER'
  | 'OTHER';

export interface NotificationDto {
  id: string;
  organizationId: string;
  userId?: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
  version: number;
}

export interface NotificationListFilters {
  unreadOnly?: boolean;
  kinds?: NotificationKind[];
  since?: string;
  until?: string;
  limit?: number;
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
