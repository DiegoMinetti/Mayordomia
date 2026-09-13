import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('googleapis', () => {
  const tokeninfo = vi.fn().mockResolvedValue({
    data: { email: 'a@b.com', email_verified: 'true' },
  });
  const userinfoGet = vi.fn().mockResolvedValue({
    data: { email: 'a@b.com', name: 'Alice', picture: '', sub: 'sub-1' },
  });
  const oauth2 = vi.fn(() => ({ tokeninfo, userinfo: { get: userinfoGet } }));
  return { google: { oauth2 } };
});

import { register, dispatch, _reset } from '../src/router/index.js';
import type { Repository } from '../src/repository/index.js';
import { makeAuditService } from '../src/audit/service.js';
import { ApiException } from '../src/errors.js';

interface FakeSheetsOptions {
  /** Extra tables (rows) to merge with the auth defaults. Takes precedence. */
  rows?: Record<string, Array<Record<string, unknown>>>;
  /** Extra findOne responses (table → row) to merge with the auth defaults. */
  findOne?: Record<string, Record<string, unknown> | null>;
}

const AUTH_USER = {
  id: 'usr_aaa',
  organizationId: 'org_123456',
  email: 'a@b.com',
  status: 'ACTIVE',
};
const AUTH_ROLE_ASSIGNMENT = {
  id: 'ur_aaa',
  organizationId: 'org_123456',
  userId: 'usr_aaa',
  roleId: 'role_aaa',
};
const AUTH_PERMISSIONS = [
  { id: 'rp_aaa', organizationId: 'org_123456', roleId: 'role_aaa', permission: 'request.review' },
  {
    id: 'rp_bbb',
    organizationId: 'org_123456',
    roleId: 'role_aaa',
    permission: 'request.approve.area',
  },
  {
    id: 'rp_ccc',
    organizationId: 'org_123456',
    roleId: 'role_aaa',
    permission: 'request.approve.general',
  },
];
const AUTH_DEFAULTS_ROWS: Record<string, Array<Record<string, unknown>>> = {
  Users: [AUTH_USER],
  UserRoles: [AUTH_ROLE_ASSIGNMENT],
  RolePermissions: AUTH_PERMISSIONS,
};
const AUTH_DEFAULTS_FIND_ONE: Record<string, Record<string, unknown> | null> = {
  Users: AUTH_USER,
};

function fakeRepo(options: FakeSheetsOptions = {}): Repository {
  const rowsMap: Record<string, Array<Record<string, unknown>>> = {
    ...AUTH_DEFAULTS_ROWS,
    ...(options.rows ?? {}),
  };
  const findOneMap: Record<string, Record<string, unknown> | null> = {
    ...AUTH_DEFAULTS_FIND_ONE,
    ...(options.findOne ?? {}),
  };
  return {
    raw: {} as never,
    spreadsheetId: 'ss-1',
    rows: vi.fn().mockImplementation(async (table: string) => rowsMap[table] ?? []),
    findOne: vi.fn().mockImplementation(async (table: string) => findOneMap[table] ?? null),
    append: vi.fn().mockResolvedValue(undefined),
    updateWhere: vi.fn().mockResolvedValue(true),
    close: vi.fn(),
  };
}

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(),
  level: 'info',
} as never;

interface FakeRow extends Record<string, unknown> {
  id: string;
  organizationId: string;
}

describe('requests handlers', () => {
  beforeEach(() => _reset());

  it('requests.list returns org-scoped requests sorted desc by createdAt', async () => {
    const requestsRows: FakeRow[] = [
      {
        id: 'req_aaa',
        organizationId: 'org_123456',
        type: 'OTHER',
        status: 'PENDING',
        source: 'INTERNAL',
        requesterName: 'A',
        description: 'a',
        createdAt: '2026-01-01T00:00:00.000Z',
        version: 1,
      },
      {
        id: 'req_bbb',
        organizationId: 'org_123456',
        type: 'OTHER',
        status: 'PENDING',
        source: 'INTERNAL',
        requesterName: 'B',
        description: 'b',
        createdAt: '2026-02-01T00:00:00.000Z',
        version: 1,
      },
      {
        id: 'req_ccc',
        organizationId: 'org_other_xxx',
        type: 'OTHER',
        status: 'PENDING',
        source: 'INTERNAL',
        requesterName: 'C',
        description: 'c',
        createdAt: '2026-03-01T00:00:00.000Z',
        version: 1,
      },
    ];
    const repo = fakeRepo({ rows: { Requests: requestsRows } });
    const audit = makeAuditService(repo, silentLogger);
    register('requests.list', { auth: true, permission: 'request.review' }, () => ({
      requests: [],
    }));
    // we registered a placeholder above; now re-register the real one
    _reset();
    const { makeRequestsHandlers } = await import('../src/requests/handlers.js');
    const handlers = makeRequestsHandlers({ repo, audit });
    register('requests.list', { auth: true, permission: 'request.review' }, (p, ctx) =>
      handlers.list(p, ctx),
    );
    const result = await dispatch(
      { action: 'requests.list', organizationId: 'org_123456', auth: { accessToken: 'tok' } },
      { repo, audit },
    );
    expect((result as { requests: Array<{ id: string }> }).requests.map((r) => r.id)).toEqual([
      'req_bbb',
      'req_aaa',
    ]);
  });

  it('requests.approve enforces optimistic concurrency and audits', async () => {
    const requestRow = {
      id: 'req_aaa',
      organizationId: 'org_123456',
      type: 'OTHER',
      status: 'PENDING',
      source: 'INTERNAL',
      requesterName: 'A',
      description: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 3,
    };
    const approvalRow = {
      id: 'appr_aaa',
      organizationId: 'org_123456',
      requestId: 'req_aaa',
      scope: 'AREA',
      areaId: undefined,
      status: 'PENDING',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 1,
    };
    const repo = fakeRepo({
      rows: { Requests: [requestRow], RequestApprovals: [approvalRow] },
      findOne: { Requests: requestRow, RequestApprovals: approvalRow },
    });
    const audit = makeAuditService(repo, silentLogger);
    const auditSpy = vi.spyOn(audit, 'record');
    const { makeRequestsHandlers } = await import('../src/requests/handlers.js');
    const handlers = makeRequestsHandlers({ repo, audit });
    register('requests.approve', { auth: true, audit: true }, (p, ctx) => handlers.approve(p, ctx));

    // wrong version → VERSION_MISMATCH
    await expect(
      dispatch(
        {
          action: 'requests.approve',
          organizationId: 'org_123456',
          auth: { accessToken: 'tok' },
          payload: { id: 'req_aaa', scope: 'AREA', expectedVersion: 1, comment: 'ok' },
        },
        { repo, audit },
      ),
    ).rejects.toMatchObject({ code: 'VERSION_MISMATCH' });

    // right version → succeeds, audits
    const result = await dispatch(
      {
        action: 'requests.approve',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
        payload: { id: 'req_aaa', scope: 'AREA', expectedVersion: 3, comment: 'ok' },
      },
      { repo, audit },
    );
    expect(result).toMatchObject({ id: 'req_aaa', version: 4 });
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'request.approve' }));
  });

  it('requests.get builds a timeline and includes approvals', async () => {
    const requestRow = {
      id: 'req_aaa',
      organizationId: 'org_123456',
      type: 'OTHER',
      status: 'PENDING',
      source: 'INTERNAL',
      requesterName: 'A',
      description: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 1,
    };
    const approvalRow = {
      id: 'appr_aaa',
      organizationId: 'org_123456',
      requestId: 'req_aaa',
      scope: 'GENERAL',
      status: 'APPROVED',
      reviewedBy: 'u1',
      reviewedAt: '2026-01-02T00:00:00.000Z',
      comment: 'lgtm',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 2,
    };
    const repo = fakeRepo({
      rows: { Requests: [requestRow], RequestApprovals: [approvalRow] },
      findOne: { Requests: requestRow },
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeRequestsHandlers } = await import('../src/requests/handlers.js');
    const handlers = makeRequestsHandlers({ repo, audit });
    register('requests.get', { auth: true, permission: 'request.review' }, (p, ctx) =>
      handlers.get(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'requests.get',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
        payload: { id: 'req_aaa' },
      },
      { repo, audit },
    );
    const req = (result as { request: { approvals: unknown[]; timeline: Array<{ kind: string }> } })
      .request;
    expect(req.approvals).toHaveLength(1);
    expect(req.timeline.map((e) => e.kind)).toEqual(['CREATED', 'APPROVED']);
  });

  it('requests.reject transitions to REJECTED and audits', async () => {
    const requestRow = {
      id: 'req_aaa',
      organizationId: 'org_123456',
      type: 'OTHER',
      status: 'PENDING_AREA_APPROVAL',
      source: 'INTERNAL',
      requesterName: 'A',
      description: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 5,
    };
    const approvalRow = {
      id: 'appr_aaa',
      organizationId: 'org_123456',
      requestId: 'req_aaa',
      scope: 'AREA',
      status: 'PENDING',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 1,
    };
    const repo = fakeRepo({
      rows: { Requests: [requestRow], RequestApprovals: [approvalRow] },
      findOne: { Requests: requestRow, RequestApprovals: approvalRow },
    });
    const audit = makeAuditService(repo, silentLogger);
    const auditSpy = vi.spyOn(audit, 'record');
    const { makeRequestsHandlers } = await import('../src/requests/handlers.js');
    const handlers = makeRequestsHandlers({ repo, audit });
    register('requests.reject', { auth: true, audit: true }, (p, ctx) => handlers.reject(p, ctx));
    const result = await dispatch(
      {
        action: 'requests.reject',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
        payload: { id: 'req_aaa', scope: 'AREA', expectedVersion: 5, comment: 'no' },
      },
      { repo, audit },
    );
    expect(result).toMatchObject({ id: 'req_aaa', status: 'REJECTED' });
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'request.reject' }));
  });

  it('requests.approve on a closed request throws REQUEST_LOCKED', async () => {
    const requestRow = {
      id: 'req_aaa',
      organizationId: 'org_123456',
      type: 'OTHER',
      status: 'APPROVED',
      source: 'INTERNAL',
      requesterName: 'A',
      description: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 1,
    };
    const repo = fakeRepo({
      rows: { Requests: [requestRow] },
      findOne: { Requests: requestRow },
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeRequestsHandlers } = await import('../src/requests/handlers.js');
    const handlers = makeRequestsHandlers({ repo, audit });
    register('requests.approve', { auth: true, audit: true }, (p, ctx) => handlers.approve(p, ctx));
    await expect(
      dispatch(
        {
          action: 'requests.approve',
          organizationId: 'org_123456',
          auth: { accessToken: 'tok' },
          payload: { id: 'req_aaa', scope: 'AREA', expectedVersion: 1, comment: '' },
        },
        { repo, audit },
      ),
    ).rejects.toMatchObject({ code: 'REQUEST_LOCKED' });
  });

  it('rejects ApiException on bad inputs', async () => {
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    const { makeRequestsHandlers } = await import('../src/requests/handlers.js');
    const handlers = makeRequestsHandlers({ repo, audit });
    register('requests.approve', { auth: true, audit: true }, (p, ctx) => handlers.approve(p, ctx));
    await expect(
      dispatch(
        {
          action: 'requests.approve',
          organizationId: 'org_123456',
          auth: { accessToken: 'tok' },
          payload: { id: 'req_aaa', scope: 'NOPE', expectedVersion: 1, comment: '' },
        },
        { repo, audit },
      ),
    ).rejects.toBeInstanceOf(ApiException);
  });
});
