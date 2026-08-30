export interface AdvancePolicy {
  minimumAdvanceDays: number;
  allowLateRequests: boolean;
}
export interface SubmitRequestInput {
  now: Date;
  eventStart: Date;
  policy: AdvancePolicy;
  urgencyReason?: string;
  canOverride?: boolean;
}
export interface SubmitRequestResult {
  allowed: boolean;
  isLate: boolean;
  daysUntilEvent: number;
  minimumAdvanceDays: number;
  reason?: string;
}

export function canSubmitRequest(input: SubmitRequestInput): SubmitRequestResult {
  const { now, eventStart, policy } = input;
  const daysUntilEvent = Math.floor((eventStart.getTime() - now.getTime()) / 86_400_000);
  if (!Number.isInteger(policy.minimumAdvanceDays) || policy.minimumAdvanceDays < 0)
    throw new Error('minimumAdvanceDays must be a non-negative integer');
  const isLate = daysUntilEvent < policy.minimumAdvanceDays;
  if (daysUntilEvent < 0)
    return {
      allowed: false,
      isLate: true,
      daysUntilEvent,
      minimumAdvanceDays: policy.minimumAdvanceDays,
      reason: 'EVENT_IN_PAST',
    };
  if (!isLate)
    return {
      allowed: true,
      isLate: false,
      daysUntilEvent,
      minimumAdvanceDays: policy.minimumAdvanceDays,
    };
  if (input.canOverride)
    return {
      allowed: true,
      isLate: true,
      daysUntilEvent,
      minimumAdvanceDays: policy.minimumAdvanceDays,
      reason: 'AUTHORIZED_OVERRIDE',
    };
  if (!policy.allowLateRequests)
    return {
      allowed: false,
      isLate: true,
      daysUntilEvent,
      minimumAdvanceDays: policy.minimumAdvanceDays,
      reason: 'INSUFFICIENT_ADVANCE',
    };
  if (!input.urgencyReason?.trim())
    return {
      allowed: false,
      isLate: true,
      daysUntilEvent,
      minimumAdvanceDays: policy.minimumAdvanceDays,
      reason: 'URGENCY_REASON_REQUIRED',
    };
  return {
    allowed: true,
    isLate: true,
    daysUntilEvent,
    minimumAdvanceDays: policy.minimumAdvanceDays,
    reason: 'LATE_REQUEST',
  };
}
