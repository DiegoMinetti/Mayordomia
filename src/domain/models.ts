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

export interface CalendarEventLink extends Entity {
  eventId: UUID;
  calendarId: string;
  googleEventId: string;
  lastPublishedHash: string;
  lastSyncedAt: string;
}
