/**
 * Domain types and constants for the Requests module.
 * Mirrors apps-script/Requests.gs.
 */

export const REQUEST_TYPES = [
  'RESOURCE',
  'LOCATION',
  'AUDIO',
  'MULTIMEDIA',
  'LIGHTING',
  'SUPPORT',
  'MAINTENANCE',
  'PURCHASE',
  'OTHER',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = [
  'DRAFT',
  'PENDING',
  'PENDING_AREA_APPROVAL',
  'PENDING_GENERAL_APPROVAL',
  'APPROVED',
  'REJECTED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_KINDS = ['PHYSICAL', 'SERVICE', 'MAINTENANCE', 'PURCHASE'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const APPROVAL_SCOPES = ['AREA', 'GENERAL'] as const;
export type ApprovalScope = (typeof APPROVAL_SCOPES)[number];

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const ROLLUP_NONE = 'NONE' as const;
export const ROLLUP_PENDING = 'PENDING' as const;
export const ROLLUP_APPROVED = 'APPROVED' as const;
export const ROLLUP_REJECTED = 'REJECTED' as const;
export type ApprovalRollup =
  | typeof ROLLUP_NONE
  | typeof ROLLUP_PENDING
  | typeof ROLLUP_APPROVED
  | typeof ROLLUP_REJECTED;
