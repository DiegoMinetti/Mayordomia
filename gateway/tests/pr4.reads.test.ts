import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('googleapis', () => {
  const tokeninfo = vi.fn().mockResolvedValue({
    data: { email: 'a@b.com', email_verified: 'true' },
  });
  const oauth2 = vi.fn(() => ({ tokeninfo }));
  return { google: { oauth2 } };
});

import { register, dispatch, _reset } from '../src/router/index.js';
import type { Repository } from '../src/repository/index.js';
import { makeAuditService } from '../src/audit/service.js';

const AUTH_USER = {
  id: 'usr_aaa',
  organizationId: 'org_123456',
  email: 'a@b.com',
  status: 'ACTIVE',
};
const AUTH_PERMISSIONS = [
  { id: 'rp_aaa', organizationId: 'org_123456', roleId: 'role_aaa', permission: 'delivery.manage' },
  {
    id: 'rp_bbb',
    organizationId: 'org_123456',
    roleId: 'role_aaa',
    permission: 'maintenance.manage',
  },
  { id: 'rp_ccc', organizationId: 'org_123456', roleId: 'role_aaa', permission: 'purchase.manage' },
];

function fakeRepo(
  rowsByTable: Record<string, Array<Record<string, unknown>>> = {},
  findOneByTable: Record<string, Record<string, unknown> | null> = {},
): Repository {
  const allRows: Record<string, Array<Record<string, unknown>>> = {
    Users: [AUTH_USER],
    UserRoles: [
      { id: 'ur_aaa', organizationId: 'org_123456', userId: 'usr_aaa', roleId: 'role_aaa' },
    ],
    RolePermissions: AUTH_PERMISSIONS,
    ...rowsByTable,
  };
  const allFindOne: Record<string, Record<string, unknown> | null> = {
    Users: AUTH_USER,
    ...findOneByTable,
  };
  return {
    raw: {} as never,
    spreadsheetId: 'ss-1',
    rows: vi.fn().mockImplementation(async (table: string) => allRows[table] ?? []),
    findOne: vi
      .fn()
      .mockImplementation(
        async (table: string, predicate: (row: Record<string, unknown>) => boolean) => {
          const override = allFindOne[table];
          if (override !== undefined) return override;
          const list = allRows[table] ?? [];
          for (const row of list) if (predicate(row)) return row;
          return null;
        },
      ),
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

describe('operations', () => {
  beforeEach(() => _reset());

  it('operations.list returns org-scoped deliveries', async () => {
    const repo = fakeRepo({
      Deliveries: [
        {
          id: 'dlv_aaa',
          organizationId: 'org_123456',
          requestId: 'req_aaa',
          deliveredBy: 'usr_aaa',
          deliveredAt: '2026-01-02T00:00:00.000Z',
          recipientName: 'A',
          status: 'IN_PROGRESS',
          version: 1,
        },
        {
          id: 'dlv_bbb',
          organizationId: 'org_123456',
          requestId: 'req_bbb',
          deliveredBy: 'usr_aaa',
          deliveredAt: '2026-01-01T00:00:00.000Z',
          recipientName: 'B',
          status: 'COMPLETED',
          version: 1,
        },
        {
          id: 'dlv_ccc',
          organizationId: 'org_other_xxx',
          requestId: 'req_ccc',
          deliveredBy: 'usr_aaa',
          deliveredAt: '2026-01-03T00:00:00.000Z',
          recipientName: 'C',
          status: 'IN_PROGRESS',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeOperationsHandlers } = await import('../src/operations/handlers.js');
    const handlers = makeOperationsHandlers({ repo });
    register('operations.list', { auth: true, permission: 'delivery.manage' }, (p, ctx) =>
      handlers.list(p, ctx),
    );
    const result = await dispatch(
      { action: 'operations.list', organizationId: 'org_123456', auth: { accessToken: 'tok' } },
      { repo, audit },
    );
    expect((result as { deliveries: Array<{ id: string }> }).deliveries.map((d) => d.id)).toEqual([
      'dlv_aaa',
      'dlv_bbb',
    ]);
  });

  it('operations.get computes progress counts', async () => {
    const delivery = {
      id: 'dlv_aaa',
      organizationId: 'org_123456',
      requestId: 'req_aaa',
      deliveredBy: 'usr_aaa',
      deliveredAt: '2026-01-02T00:00:00.000Z',
      recipientName: 'A',
      status: 'IN_PROGRESS',
      version: 1,
    };
    const repo = fakeRepo(
      {
        Deliveries: [delivery],
        DeliveryItems: [
          {
            id: 'di_aaa',
            organizationId: 'org_123456',
            deliveryId: 'dlv_aaa',
            resourceId: 'res_aaa',
            quantity: 1,
            returnedAt: '',
            condition: '',
            version: 1,
          },
          {
            id: 'di_bbb',
            organizationId: 'org_123456',
            deliveryId: 'dlv_aaa',
            resourceId: 'res_bbb',
            quantity: 1,
            returnedAt: '2026-01-03T00:00:00.000Z',
            condition: 'OK',
            version: 1,
          },
        ],
      },
      { Deliveries: delivery },
    );
    const audit = makeAuditService(repo, silentLogger);
    const { makeOperationsHandlers } = await import('../src/operations/handlers.js');
    const handlers = makeOperationsHandlers({ repo });
    register('operations.get', { auth: true, permission: 'delivery.manage' }, (p, ctx) =>
      handlers.get(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'operations.get',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
        payload: { id: 'dlv_aaa' },
      },
      { repo, audit },
    );
    expect(
      (
        result as {
          progress: {
            totalItems: number;
            returnedItems: number;
            openItems: number;
            damageCount: number;
          };
        }
      ).progress,
    ).toEqual({
      totalItems: 2,
      returnedItems: 1,
      openItems: 1,
      damageCount: 0,
    });
  });
});

describe('maintenance', () => {
  beforeEach(() => _reset());

  it('maintenance.list filters by severity', async () => {
    const repo = fakeRepo({
      Maintenance: [
        {
          id: 'mnt_aaa',
          organizationId: 'org_123456',
          reportedBy: 'usr_aaa',
          reportedAt: '2026-01-01T00:00:00.000Z',
          kind: 'CORRECTIVE',
          severity: 'HIGH',
          status: 'OPEN',
          description: 'Broken',
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'mnt_bbb',
          organizationId: 'org_123456',
          reportedBy: 'usr_aaa',
          reportedAt: '2026-01-02T00:00:00.000Z',
          kind: 'PREVENTIVE',
          severity: 'LOW',
          status: 'OPEN',
          description: 'Oil change',
          createdAt: '2026-01-02T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeMaintenanceHandlers } = await import('../src/maintenance/handlers.js');
    const handlers = makeMaintenanceHandlers({ repo });
    register('maintenance.list', { auth: true, permission: 'maintenance.manage' }, (p, ctx) =>
      handlers.list(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'maintenance.list',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
        payload: { severity: 'HIGH' },
      },
      { repo, audit },
    );
    expect((result as { maintenance: Array<{ id: string }> }).maintenance.map((m) => m.id)).toEqual(
      ['mnt_aaa'],
    );
  });
});

describe('purchases', () => {
  beforeEach(() => _reset());

  it('purchases.listRequests returns counts per request', async () => {
    const repo = fakeRepo({
      PurchaseRequests: [
        {
          id: 'pr_aaa',
          organizationId: 'org_123456',
          title: 'A',
          status: 'SUBMITTED',
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'pr_bbb',
          organizationId: 'org_123456',
          title: 'B',
          status: 'SUBMITTED',
          createdAt: '2026-01-02T00:00:00.000Z',
          version: 1,
        },
      ],
      PurchaseRequestItems: [
        {
          id: 'pri_aaa',
          organizationId: 'org_123456',
          purchaseRequestId: 'pr_aaa',
          name: 'Mic',
          quantity: 2,
          estimatedCost: 100,
          unit: 'unidad',
          version: 1,
        },
        {
          id: 'pri_bbb',
          organizationId: 'org_123456',
          purchaseRequestId: 'pr_aaa',
          name: 'Cable',
          quantity: 5,
          estimatedCost: 10,
          unit: 'unidad',
          version: 1,
        },
        {
          id: 'pri_ccc',
          organizationId: 'org_123456',
          purchaseRequestId: 'pr_bbb',
          name: 'Stand',
          quantity: 1,
          estimatedCost: 50,
          unit: 'unidad',
          version: 1,
        },
      ],
      Quotes: [
        {
          id: 'q_aaa',
          organizationId: 'org_123456',
          purchaseRequestId: 'pr_aaa',
          supplierId: 'sup_aaa',
          price: 250,
          currency: 'ARS',
          qualityScore: 4,
          deliveryDays: 5,
          warrantyMonths: 12,
          technicalFitScore: 4,
          status: 'PENDING',
          submittedAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makePurchasesHandlers } = await import('../src/purchases/handlers.js');
    const handlers = makePurchasesHandlers({ repo });
    register('purchases.listRequests', { auth: true, permission: 'purchase.manage' }, (p, ctx) =>
      handlers.listRequests(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'purchases.listRequests',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
      },
      { repo, audit },
    );
    const reqs = (
      result as {
        requests: Array<{
          id: string;
          itemCount: number;
          quoteCount: number;
          estimatedTotal: number;
        }>;
      }
    ).requests;
    expect(reqs[0]?.id).toBe('pr_bbb');
    expect(reqs[1]?.itemCount).toBe(2);
    expect(reqs[1]?.quoteCount).toBe(1);
    expect(reqs[1]?.estimatedTotal).toBe(250); // 2*100 + 5*10
  });

  it('purchases.listSuppliers filters by active', async () => {
    const repo = fakeRepo({
      Suppliers: [
        { id: 'sup_aaa', organizationId: 'org_123456', name: 'A', active: true, version: 1 },
        { id: 'sup_bbb', organizationId: 'org_123456', name: 'B', active: false, version: 1 },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makePurchasesHandlers } = await import('../src/purchases/handlers.js');
    const handlers = makePurchasesHandlers({ repo });
    register('purchases.listSuppliers', { auth: true, permission: 'purchase.manage' }, (p, ctx) =>
      handlers.listSuppliers(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'purchases.listSuppliers',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
        payload: { active: true },
      },
      { repo, audit },
    );
    expect((result as { suppliers: Array<{ id: string }> }).suppliers.map((s) => s.id)).toEqual([
      'sup_aaa',
    ]);
  });
});

describe('notifications', () => {
  beforeEach(() => _reset());

  it('notifications.listMine includes org-wide and filters by user', async () => {
    const repo = fakeRepo({
      Notifications: [
        {
          id: 'nt_aaa',
          organizationId: 'org_123456',
          userId: '',
          kind: 'OTHER',
          title: 'Org wide',
          read: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'nt_bbb',
          organizationId: 'org_123456',
          userId: 'usr_aaa',
          kind: 'OTHER',
          title: 'Mine',
          read: false,
          createdAt: '2026-01-02T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'nt_ccc',
          organizationId: 'org_123456',
          userId: 'usr_zzz',
          kind: 'OTHER',
          title: 'Other user',
          read: false,
          createdAt: '2026-01-03T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeNotificationsHandlers } = await import('../src/notifications/handlers.js');
    const handlers = makeNotificationsHandlers({ repo });
    register('notifications.listMine', { auth: true }, (p, ctx) => handlers.listMine(p, ctx));
    const result = await dispatch(
      {
        action: 'notifications.listMine',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
      },
      { repo, audit },
    );
    const titles = (result as { notifications: Array<{ title: string }> }).notifications.map(
      (n) => n.title,
    );
    expect(titles).toContain('Org wide');
    expect(titles).toContain('Mine');
    expect(titles).not.toContain('Other user');
  });

  it('notifications.unreadCount counts only unread for user+org-wide', async () => {
    const repo = fakeRepo({
      Notifications: [
        {
          id: 'nt_aaa',
          organizationId: 'org_123456',
          userId: '',
          kind: 'OTHER',
          title: 'a',
          read: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'nt_bbb',
          organizationId: 'org_123456',
          userId: 'usr_aaa',
          kind: 'OTHER',
          title: 'b',
          read: false,
          createdAt: '2026-01-02T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'nt_ccc',
          organizationId: 'org_123456',
          userId: 'usr_aaa',
          kind: 'OTHER',
          title: 'c',
          read: true,
          createdAt: '2026-01-03T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeNotificationsHandlers } = await import('../src/notifications/handlers.js');
    const handlers = makeNotificationsHandlers({ repo });
    register('notifications.unreadCount', { auth: true }, (p, ctx) => handlers.unreadCount(p, ctx));
    const result = await dispatch(
      {
        action: 'notifications.unreadCount',
        organizationId: 'org_123456',
        auth: { accessToken: 'tok' },
      },
      { repo, audit },
    );
    expect((result as { count: number }).count).toBe(2);
  });
});
