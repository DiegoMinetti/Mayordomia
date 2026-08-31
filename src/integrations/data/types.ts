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

export interface RequestGatewayEnvelope<T> {
  ok: true;
  data: T;
  error?: null;
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
