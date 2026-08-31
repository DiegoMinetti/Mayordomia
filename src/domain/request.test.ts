import { describe, expect, it } from 'vitest';
import { deriveRequestState, rollupApprovals, toDerivedRequest, toRequestEntity } from './request';
import type { AdvancePolicy } from './advance';
import type { RequestApproval, RequestEntity } from './models';

const policy: AdvancePolicy = { minimumAdvanceDays: 7, allowLateRequests: true };

const baseEntity: RequestEntity = {
  id: 'r1',
  organizationId: 'o1',
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
  createdBy: 'u1',
  updatedBy: 'u1',
  version: 1,
  type: 'AUDIO',
  requesterName: 'Carla',
  description: 'Sonido para reunión',
  source: 'INTERNAL',
  status: 'PENDING_AREA_APPROVAL',
};

const makeApproval = (
  scope: 'AREA' | 'GENERAL',
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  areaId?: string,
): RequestApproval => ({
  id: `${scope}-${status}`,
  organizationId: 'o1',
  requestId: 'r1',
  scope,
  areaId,
  status,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
  createdBy: 'u1',
  updatedBy: 'u1',
  version: 1,
});

describe('deriveRequestState', () => {
  it('flags pending area approval when only the area row is open', () => {
    const flags = deriveRequestState(baseEntity, [makeApproval('AREA', 'PENDING', 'a1')]);
    expect(flags.needsAreaApproval).toBe(true);
    expect(flags.needsGeneralApproval).toBe(false);
    expect(flags.currentStatus).toBe('PENDING_AREA_APPROVAL');
    expect(flags.outcome).toBe('PENDING');
  });

  it('rolls up to PENDING_GENERAL_APPROVAL once the area row is approved', () => {
    const flags = deriveRequestState(baseEntity, [
      makeApproval('AREA', 'APPROVED', 'a1'),
      makeApproval('GENERAL', 'PENDING'),
    ]);
    expect(flags.needsAreaApproval).toBe(false);
    expect(flags.needsGeneralApproval).toBe(true);
    expect(flags.currentStatus).toBe('PENDING_GENERAL_APPROVAL');
  });

  it('marks the request APPROVED when every row is approved', () => {
    const flags = deriveRequestState(baseEntity, [
      makeApproval('AREA', 'APPROVED', 'a1'),
      makeApproval('GENERAL', 'APPROVED'),
    ]);
    expect(flags.currentStatus).toBe('APPROVED');
    expect(flags.outcome).toBe('APPROVED');
  });

  it('marks the request REJECTED when any row is rejected', () => {
    const flags = deriveRequestState(baseEntity, [
      makeApproval('AREA', 'APPROVED', 'a1'),
      makeApproval('GENERAL', 'REJECTED'),
    ]);
    expect(flags.currentStatus).toBe('REJECTED');
    expect(flags.outcome).toBe('REJECTED');
  });

  it('falls back to the stored status when there are no approvals', () => {
    const flags = deriveRequestState({ ...baseEntity, status: 'PENDING' }, []);
    expect(flags.currentStatus).toBe('PENDING');
    expect(flags.needsAreaApproval).toBe(false);
    expect(flags.needsGeneralApproval).toBe(false);
  });

  it('flags isLate when the event is inside the advance window', () => {
    const entity: RequestEntity = {
      ...baseEntity,
      createdAt: '2026-08-30T10:00:00Z',
      eventStart: '2026-09-02T19:00:00Z',
    };
    const flags = deriveRequestState(entity, [], policy);
    expect(flags.isLate).toBe(true);
  });

  it('returns isLate=false when the event is outside the advance window', () => {
    const entity: RequestEntity = {
      ...baseEntity,
      createdAt: '2026-08-20T10:00:00Z',
      eventStart: '2026-09-10T19:00:00Z',
    };
    const flags = deriveRequestState(entity, [], policy);
    expect(flags.isLate).toBe(false);
  });
});

describe('rollupApprovals', () => {
  it('returns NONE when no approvals exist', () => {
    expect(rollupApprovals([])).toEqual({ area: 'NONE', general: 'NONE' });
  });

  it('returns APPROVED when every approval in a scope is approved', () => {
    const result = rollupApprovals([
      makeApproval('AREA', 'APPROVED', 'a1'),
      makeApproval('AREA', 'APPROVED', 'a2'),
    ]);
    expect(result.area).toBe('APPROVED');
    expect(result.general).toBe('NONE');
  });

  it('returns REJECTED if any approval in the scope is rejected', () => {
    const result = rollupApprovals([
      makeApproval('AREA', 'APPROVED', 'a1'),
      makeApproval('AREA', 'REJECTED', 'a2'),
    ]);
    expect(result.area).toBe('REJECTED');
  });
});

describe('toRequestEntity', () => {
  it('maps a DTO to the domain entity, defaulting unknown statuses to PENDING', () => {
    const entity = toRequestEntity({
      id: 'r1',
      organizationId: 'o1',
      type: 'AUDIO',
      requesterName: 'Carla',
      description: 'Sonido',
      source: 'INTERNAL',
      status: 'NOT_A_STATUS' as unknown as import('./models').RequestStatus,
      createdAt: '2026-08-20T10:00:00Z',
      version: 1,
    });
    expect(entity.status).toBe('PENDING');
    expect(entity.type).toBe('AUDIO');
  });
});

describe('toDerivedRequest', () => {
  it('combines entity + approvals + timeline + flags in one shape', () => {
    const derived = toDerivedRequest(
      {
        id: 'r1',
        organizationId: 'o1',
        type: 'AUDIO',
        requesterName: 'Carla',
        description: 'Sonido',
        source: 'INTERNAL',
        status: 'PENDING_AREA_APPROVAL',
        createdAt: '2026-08-20T10:00:00Z',
        version: 1,
        approvals: [
          {
            id: 'a1',
            requestId: 'r1',
            scope: 'AREA',
            areaId: 'area-1',
            status: 'PENDING',
            createdAt: '2026-08-20T10:00:00Z',
            version: 1,
          },
        ],
        timeline: [
          {
            at: '2026-08-20T10:00:00Z',
            kind: 'CREATED',
            actor: 'public',
            label: 'Solicitud creada',
          },
        ],
      },
      policy,
    );
    expect(derived.approvals).toHaveLength(1);
    expect(derived.timeline).toHaveLength(1);
    expect(derived.flags.needsAreaApproval).toBe(true);
  });
});
