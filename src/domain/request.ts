/**
 * Request domain helpers.
 *
 * The catalog returns a flat DTO; this module re-shapes the data into the
 * richer domain view that the UI consumes (state flags, timeline, approval
 * rollup). The mapping is intentionally pure so it can be exercised in tests
 * without touching the network.
 */
import type { AdvancePolicy } from './advance';
import { canSubmitRequest } from './advance';
import { resolveApprovalOutcome, type ApprovalOutcome } from './approvals';
import type {
  ApprovalScope,
  RequestApproval,
  RequestEntity,
  RequestStatus,
  RequestTimelineEvent,
  UUID,
} from './models';

export interface RequestDto {
  id: string;
  organizationId: string;
  siteId?: string;
  type: string;
  kind?: string;
  requesterName: string;
  requesterEmail?: string;
  description: string;
  requestedFor?: string;
  source: string;
  status: RequestStatus;
  eventStart?: string;
  eventEnd?: string;
  urgencyReason?: string;
  lateReason?: string;
  currentArea?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
  approvals?: RequestApprovalDto[];
  timeline?: RequestTimelineEventDto[];
  approvalSummary?: { area: ApprovalRollup; general: ApprovalRollup };
  needsAreaApproval?: boolean;
  needsGeneralApproval?: boolean;
  flags?: RequestFlags;
}

export interface RequestApprovalDto {
  id: string;
  requestId: string;
  scope: ApprovalScope;
  areaId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  comment?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface RequestTimelineEventDto {
  at: string;
  kind: RequestTimelineEvent['kind'];
  actor: string;
  label: string;
  scope?: ApprovalScope;
  areaId?: string;
  comment?: string;
}

export type ApprovalRollup = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RequestFlags {
  needsAreaApproval: boolean;
  needsGeneralApproval: boolean;
  currentStatus: RequestStatus;
  isLate: boolean;
  outcome: ApprovalOutcome;
}

export interface RequestDerived extends RequestEntity {
  approvals: RequestApproval[];
  timeline: RequestTimelineEvent[];
  flags: RequestFlags;
}

const ALLOWED_STATUSES: ReadonlySet<RequestStatus> = new Set<RequestStatus>([
  'DRAFT',
  'PENDING',
  'PENDING_AREA_APPROVAL',
  'PENDING_GENERAL_APPROVAL',
  'APPROVED',
  'REJECTED',
  'DELIVERED',
  'CANCELLED',
]);

function toRequestType(value: string): RequestEntity['type'] {
  const allowed: RequestEntity['type'][] = [
    'RESOURCE',
    'LOCATION',
    'AUDIO',
    'MULTIMEDIA',
    'LIGHTING',
    'SUPPORT',
    'MAINTENANCE',
    'PURCHASE',
    'OTHER',
  ];
  return (allowed as string[]).includes(value) ? (value as RequestEntity['type']) : 'OTHER';
}

function toRequestStatus(value: string): RequestStatus {
  return ALLOWED_STATUSES.has(value as RequestStatus) ? (value as RequestStatus) : 'PENDING';
}

export function toRequestEntity(dto: RequestDto): RequestEntity {
  return {
    id: dto.id,
    organizationId: dto.organizationId,
    siteId: dto.siteId,
    type: toRequestType(dto.type),
    kind: dto.kind as RequestEntity['kind'],
    requesterName: dto.requesterName,
    requesterEmail: dto.requesterEmail,
    description: dto.description,
    requestedFor: dto.requestedFor,
    source: (dto.source as RequestEntity['source']) || 'INTERNAL',
    status: toRequestStatus(dto.status),
    eventStart: dto.eventStart,
    eventEnd: dto.eventEnd,
    urgencyReason: dto.urgencyReason,
    lateReason: dto.lateReason,
    currentArea: dto.currentArea,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? dto.createdAt,
    createdBy: '',
    updatedBy: '',
    version: dto.version,
  };
}

export function toRequestApprovals(dtos: RequestApprovalDto[] | undefined): RequestApproval[] {
  if (!dtos) return [];
  return dtos.map((a) => ({
    id: a.id,
    organizationId: '',
    requestId: a.requestId,
    scope: a.scope,
    areaId: a.areaId as UUID,
    status: a.status,
    reviewedBy: a.reviewedBy as UUID,
    reviewedAt: a.reviewedAt,
    comment: a.comment,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt ?? a.createdAt,
    createdBy: '',
    updatedBy: '',
    version: a.version,
  }));
}

export function toRequestTimeline(
  dtos: RequestTimelineEventDto[] | undefined,
): RequestTimelineEvent[] {
  if (!dtos) return [];
  return dtos.map((e) => ({
    at: e.at,
    kind: e.kind,
    actor: e.actor as UUID,
    label: e.label,
    scope: e.scope,
    areaId: e.areaId as UUID,
    comment: e.comment,
  }));
}

export function rollupApprovals(approvals: RequestApproval[]): {
  area: ApprovalRollup;
  general: ApprovalRollup;
} {
  const area = approvals.filter((a) => a.scope === 'AREA');
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  return { area: rollup(area), general: rollup(general) };
}

function rollup(list: RequestApproval[]): ApprovalRollup {
  if (!list.length) return 'NONE';
  if (list.some((a) => a.status === 'REJECTED')) return 'REJECTED';
  if (list.every((a) => a.status === 'APPROVED')) return 'APPROVED';
  return 'PENDING';
}

/**
 * Compute the user-facing state flags for a request.
 *
 *  - `needsAreaApproval` / `needsGeneralApproval`: true when at least one
 *    matching approval is still PENDING.
 *  - `currentStatus`: APPROVED / REJECTED / PENDING (rolled up across all
 *    approvals). Falls back to the request's stored status when no approval
 *    rows exist yet.
 *  - `isLate`: true when the advance policy says the event would have been
 *    late at submission time. Only computed when `eventStart` is present.
 *  - `outcome`: the result of `resolveApprovalOutcome` for convenience.
 */
export function deriveRequestState(
  request: RequestEntity,
  approvals: RequestApproval[],
  policy?: AdvancePolicy,
): RequestFlags {
  const area = approvals.filter((a) => a.scope === 'AREA');
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  const needsArea = area.length > 0 && area.every((a) => a.status === 'PENDING');
  const needsGeneral = general.length > 0 && general.every((a) => a.status === 'PENDING');
  const outcome = approvals.length ? resolveApprovalOutcome(approvals) : 'PENDING';
  const currentStatus = computeCurrentStatus(request.status, approvals);
  const isLate = computeIsLate(request, policy);
  return {
    needsAreaApproval: needsArea,
    needsGeneralApproval: needsGeneral,
    currentStatus,
    isLate,
    outcome,
  };
}

function computeCurrentStatus(
  fallback: RequestStatus,
  approvals: RequestApproval[],
): RequestStatus {
  if (!approvals.length) return fallback;
  if (approvals.some((a) => a.status === 'REJECTED')) return 'REJECTED';
  if (approvals.every((a) => a.status === 'APPROVED')) return 'APPROVED';
  const general = approvals.filter((a) => a.scope === 'GENERAL');
  if (general.length && general.every((a) => a.status === 'PENDING')) {
    return 'PENDING_GENERAL_APPROVAL';
  }
  return 'PENDING_AREA_APPROVAL';
}

function computeIsLate(request: RequestEntity, policy?: AdvancePolicy): boolean {
  if (!policy || !request.eventStart) return false;
  const result = canSubmitRequest({
    now: new Date(request.createdAt),
    eventStart: new Date(request.eventStart),
    policy,
  });
  return result.isLate;
}

export function toDerivedRequest(dto: RequestDto, policy?: AdvancePolicy): RequestDerived {
  const entity = toRequestEntity(dto);
  const approvals = toRequestApprovals(dto.approvals);
  const timeline = toRequestTimeline(dto.timeline);
  const flags = deriveRequestState(entity, approvals, policy);
  return { ...entity, approvals, timeline, flags };
}

/** Sort helper: newest first by createdAt. */
export function sortRequestsByDate(list: RequestEntity[]): RequestEntity[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
