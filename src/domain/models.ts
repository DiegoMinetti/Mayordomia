export type UUID = string;

export interface Entity {
  id: UUID;
  organizationId: UUID;
  siteId?: UUID;
  createdAt: string;
  createdBy: UUID;
  updatedAt: string;
  updatedBy: UUID;
  deletedAt?: string;
  version: number;
}

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';
export interface User extends Entity {
  personId?: UUID;
  email: string;
  status: UserStatus;
}
export interface Role extends Entity {
  name: string;
  permissionIds: UUID[];
  siteIds?: UUID[];
  areaIds?: UUID[];
}
export interface Permission extends Entity {
  key: string;
  description?: string;
}

export type InventoryType = 'SERIALIZED' | 'QUANTITY';
export type ResourceStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'DELIVERED'
  | 'IN_USE'
  | 'RETURN_PENDING'
  | 'MAINTENANCE'
  | 'BROKEN'
  | 'MISSING'
  | 'RETIRED';
export interface Resource extends Entity {
  name: string;
  inventoryType: InventoryType;
  status: ResourceStatus;
  areaId?: UUID;
  locationId?: UUID;
  quantity: number;
  unit: string;
}

export type ReservationKind = 'RESOURCE' | 'LOCATION';
export type ReservationStatus = 'PENDING_RESERVATION' | 'CONFIRMED' | 'CANCELLED';
export interface Reservation extends Entity {
  kind: ReservationKind;
  targetId: UUID;
  requestId: UUID;
  startAt: string;
  endAt: string;
  quantity: number;
  status: ReservationStatus;
}

export type ApprovalScope = 'AREA' | 'GENERAL';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface RequestApproval extends Entity {
  requestId: UUID;
  scope: ApprovalScope;
  areaId?: UUID;
  status: ApprovalStatus;
  reviewedBy?: UUID;
  reviewedAt?: string;
  comment?: string;
}

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

export type RequestKind = 'PHYSICAL' | 'SERVICE' | 'MAINTENANCE' | 'PURCHASE';

export type RequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PENDING_AREA_APPROVAL'
  | 'PENDING_GENERAL_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'DELIVERED'
  | 'CANCELLED';

export type RequestSource = 'PUBLIC_QR' | 'INTERNAL' | 'ADMIN' | 'IMPORTED';

export interface RequestTimelineEvent {
  at: string;
  kind: 'CREATED' | 'APPROVED' | 'REJECTED' | 'STATUS_CHANGED';
  actor: UUID;
  label: string;
  scope?: ApprovalScope;
  areaId?: UUID;
  comment?: string;
}

export interface RequestEntity extends Entity {
  type: RequestType;
  kind?: RequestKind;
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
  currentArea?: UUID;
}

export interface CalendarEventLink extends Entity {
  eventId: UUID;
  calendarId: string;
  googleEventId: string;
  lastPublishedHash: string;
  lastSyncedAt: string;
}
