import type { RequestApproval, UUID } from './models';

export interface ApprovalPolicy {
  requireAreaApproval: boolean;
  requireGeneralApproval: boolean;
}
export type ApprovalOutcome = 'PENDING' | 'APPROVED' | 'REJECTED';

export function buildApprovalPlan(
  organizationId: UUID,
  requestId: UUID,
  areaIds: UUID[],
  policy: ApprovalPolicy,
  actorId: UUID,
  now: string,
  id: () => UUID,
): RequestApproval[] {
  const uniqueAreas = [...new Set(areaIds)];
  const base = {
    organizationId,
    requestId,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
    updatedBy: actorId,
    version: 1,
    status: 'PENDING' as const,
  };
  const approvals: RequestApproval[] = policy.requireAreaApproval
    ? uniqueAreas.map((areaId) => ({ ...base, id: id(), scope: 'AREA' as const, areaId }))
    : [];
  if (policy.requireGeneralApproval) approvals.push({ ...base, id: id(), scope: 'GENERAL' });
  return approvals;
}

export function resolveApprovalOutcome(approvals: RequestApproval[]): ApprovalOutcome {
  if (approvals.some((a) => a.status === 'REJECTED')) return 'REJECTED';
  if (approvals.every((a) => a.status === 'APPROVED')) return 'APPROVED';
  return 'PENDING';
}
