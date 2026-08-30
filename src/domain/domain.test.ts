import { describe, expect, it } from 'vitest';
import { canSubmitRequest } from './advance';
import { resolveApprovalOutcome } from './approvals';
import { findReservationConflicts } from './reservations';
import { scoreQuotes, validatePurchaseDecision } from './purchasing';
import type { RequestApproval, Reservation, Resource } from './models';

const entity = {
  organizationId: 'o',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  createdBy: 'u',
  updatedBy: 'u',
  version: 1,
};
describe('advance rules', () => {
  it('requires urgency reason for an allowed late request', () => {
    const base = {
      now: new Date('2026-01-01T12:00:00Z'),
      eventStart: new Date('2026-01-05T12:00:00Z'),
      policy: { minimumAdvanceDays: 7, allowLateRequests: true },
    };
    expect(canSubmitRequest(base).reason).toBe('URGENCY_REASON_REQUIRED');
    expect(canSubmitRequest({ ...base, urgencyReason: 'Falla imprevista' })).toMatchObject({
      allowed: true,
      isLate: true,
      reason: 'LATE_REQUEST',
    });
  });
});
describe('approvals', () => {
  it('rejects globally if any required approval rejects', () => {
    const approvals = [{ status: 'APPROVED' }, { status: 'REJECTED' }] as RequestApproval[];
    expect(resolveApprovalOutcome(approvals)).toBe('REJECTED');
  });
});
describe('reservations', () => {
  const resource: Resource = {
    ...entity,
    id: 'r',
    name: 'Sillas',
    inventoryType: 'QUANTITY',
    status: 'AVAILABLE',
    quantity: 10,
    unit: 'u',
  };
  const existing = [
    {
      ...entity,
      id: 'x',
      kind: 'RESOURCE',
      targetId: 'r',
      requestId: 'q',
      startAt: '2026-01-02T10:00:00Z',
      endAt: '2026-01-02T12:00:00Z',
      quantity: 7,
      status: 'CONFIRMED',
    },
  ] as Reservation[];
  it('detects insufficient stock only for overlapping intervals', () => {
    expect(
      findReservationConflicts(
        resource,
        {
          kind: 'RESOURCE',
          targetId: 'r',
          startAt: '2026-01-02T11:00:00Z',
          endAt: '2026-01-02T13:00:00Z',
          quantity: 4,
        },
        existing,
      )[0],
    ).toMatchObject({ code: 'INSUFFICIENT_QUANTITY', available: 3 });
  });
});
describe('purchase scoring', () => {
  it('is transparent and requires justification for an override', () => {
    const weights = {
      price: 50,
      quality: 50,
      delivery: 0,
      warranty: 0,
      supplierHistory: 0,
      technicalFit: 0,
    };
    const scores = scoreQuotes(
      [
        {
          quoteId: 'a',
          price: 100,
          quality: 50,
          delivery: 0,
          warranty: 0,
          supplierHistory: 0,
          technicalFit: 0,
        },
        {
          quoteId: 'b',
          price: 120,
          quality: 100,
          delivery: 0,
          warranty: 0,
          supplierHistory: 0,
          technicalFit: 0,
        },
      ],
      weights,
    );
    expect(scores[0].quoteId).toBe('b');
    expect(() => validatePurchaseDecision('a', scores)).toThrow(/justification/);
  });
});
