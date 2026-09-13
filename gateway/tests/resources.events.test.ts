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
import { createHash } from 'node:crypto';

const SESSION_TOKEN = 'sess_' + 'a'.repeat(43);
const SESSION_ID = createHash('sha256').update(SESSION_TOKEN).digest('hex');
const AUTH_SESSION = {
  id: SESSION_ID,
  userId: 'usr_aaa',
  organizationId: 'org_123456',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  createdAt: new Date().toISOString(),
  revokedAt: '',
  userAgent: '',
  ip: '',
};
import { makeAuditService } from '../src/audit/service.js';

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
  { id: 'rp_aaa', organizationId: 'org_123456', roleId: 'role_aaa', permission: 'resource.review' },
  { id: 'rp_bbb', organizationId: 'org_123456', roleId: 'role_aaa', permission: 'event.review' },
];

function fakeRepo(
  rowsByTable: Record<string, Array<Record<string, unknown>>> = {},
  findOneByTable: Record<string, Record<string, unknown> | null> = {},
): Repository {
  const allRows: Record<string, Array<Record<string, unknown>>> = {
    users: [AUTH_USER],
    user_roles: [AUTH_ROLE_ASSIGNMENT],
    role_permissions: AUTH_PERMISSIONS,
    ...rowsByTable,
  };
  const allFindOne: Record<string, Record<string, unknown> | null> = {
    users: AUTH_USER,
    sessions: AUTH_SESSION,
    ...findOneByTable,
  };
  return {
    raw: {} as never,
    spreadsheetId: 'ss-1',
    rows: vi.fn().mockImplementation(async (table: string) => allRows[table] ?? []),
    // findOne respects the predicate so per-id lookups work; when the test
    // passes a fixed row via findOneByTable, that row wins.
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

describe('resources handlers', () => {
  beforeEach(() => _reset());

  it('resources.list filters by org + name', async () => {
    const repo = fakeRepo({
      Resources: [
        {
          id: 'res_aaa',
          organizationId: 'org_123456',
          siteId: 'site_aaa',
          kind: 'PHYSICAL',
          name: 'Alpha',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'res_bbb',
          organizationId: 'org_123456',
          siteId: 'site_aaa',
          kind: 'PHYSICAL',
          name: 'Bravo',
          status: 'ACTIVE',
          createdAt: '2026-01-02T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'res_ccc',
          organizationId: 'org_other_xxx',
          siteId: 'site_aaa',
          kind: 'PHYSICAL',
          name: 'Charlie',
          status: 'ACTIVE',
          createdAt: '2026-01-03T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeResourcesHandlers } = await import('../src/resources/handlers.js');
    const handlers = makeResourcesHandlers({ repo });
    register('resources.list', { auth: true, permission: 'resource.review' }, (p, ctx) =>
      handlers.list(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'resources.list',
        organizationId: 'org_123456',
        auth: { sessionToken: SESSION_TOKEN },
      },
      { repo, audit },
    );
    const ids = (result as { resources: Array<{ id: string }> }).resources.map((r) => r.id);
    expect(ids).toEqual(['res_aaa', 'res_bbb']);
  });

  it('resources.get returns the resource or NOT_FOUND', async () => {
    const resource = {
      id: 'res_aaa',
      organizationId: 'org_123456',
      kind: 'PHYSICAL',
      name: 'A',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      version: 1,
    };
    const repo = fakeRepo({ Resources: [resource] });
    const audit = makeAuditService(repo, silentLogger);
    const { makeResourcesHandlers } = await import('../src/resources/handlers.js');
    const handlers = makeResourcesHandlers({ repo });
    register('resources.get', { auth: true, permission: 'resource.review' }, (p, ctx) =>
      handlers.get(p, ctx),
    );
    const ok = await dispatch(
      {
        action: 'resources.get',
        organizationId: 'org_123456',
        auth: { sessionToken: SESSION_TOKEN },
        payload: { id: 'res_aaa' },
      },
      { repo, audit },
    );
    expect((ok as { resource: { id: string } }).resource.id).toBe('res_aaa');
    await expect(
      dispatch(
        {
          action: 'resources.get',
          organizationId: 'org_123456',
          auth: { sessionToken: SESSION_TOKEN },
          payload: { id: 'res_missing' },
        },
        { repo, audit },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resources.listLocations returns org-scoped locations', async () => {
    const repo = fakeRepo({
      Locations: [
        {
          id: 'loc_aaa',
          organizationId: 'org_123456',
          siteId: 'site_aaa',
          kind: 'ROOM',
          name: 'Sala A',
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'loc_bbb',
          organizationId: 'org_other_xxx',
          siteId: 'site_aaa',
          kind: 'ROOM',
          name: 'Sala B',
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeResourcesHandlers } = await import('../src/resources/handlers.js');
    const handlers = makeResourcesHandlers({ repo });
    register('resources.listLocations', { auth: true, permission: 'resource.review' }, (p, ctx) =>
      handlers.listLocations(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'resources.listLocations',
        organizationId: 'org_123456',
        auth: { sessionToken: SESSION_TOKEN },
      },
      { repo, audit },
    );
    expect((result as { locations: unknown[] }).locations).toHaveLength(1);
  });
});

describe('events handlers', () => {
  beforeEach(() => _reset());

  it('events.list filters by date range', async () => {
    const repo = fakeRepo({
      Events: [
        {
          id: 'ev_aaa',
          organizationId: 'org_123456',
          kind: 'SERVICE',
          title: 'Past',
          startAt: '2025-01-01T00:00:00.000Z',
          endAt: '2025-01-01T01:00:00.000Z',
          status: 'COMPLETED',
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'ev_bbb',
          organizationId: 'org_123456',
          kind: 'SERVICE',
          title: 'Future',
          startAt: '2099-01-01T00:00:00.000Z',
          endAt: '2099-01-01T01:00:00.000Z',
          status: 'PLANNED',
          createdAt: '2099-01-01T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeEventsHandlers } = await import('../src/events/handlers.js');
    const handlers = makeEventsHandlers({ repo });
    register('events.list', { auth: true, permission: 'event.review' }, (p, ctx) =>
      handlers.list(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'events.list',
        organizationId: 'org_123456',
        auth: { sessionToken: SESSION_TOKEN },
        payload: { startAfter: '2030-01-01T00:00:00.000Z' },
      },
      { repo, audit },
    );
    const evs = (result as { events: Array<{ id: string }> }).events;
    expect(evs.map((e) => e.id)).toEqual(['ev_bbb']);
  });

  it('events.upcoming returns events within window', async () => {
    const inFuture = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const inFuture2 = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const repo = fakeRepo({
      Events: [
        {
          id: 'ev_aaa',
          organizationId: 'org_123456',
          kind: 'SERVICE',
          title: 'Soon',
          startAt: inFuture,
          endAt: inFuture,
          status: 'PLANNED',
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
        {
          id: 'ev_bbb',
          organizationId: 'org_123456',
          kind: 'SERVICE',
          title: 'Later',
          startAt: inFuture2,
          endAt: inFuture2,
          status: 'PLANNED',
          createdAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
      ],
    });
    const audit = makeAuditService(repo, silentLogger);
    const { makeEventsHandlers } = await import('../src/events/handlers.js');
    const handlers = makeEventsHandlers({ repo });
    register('events.upcoming', { auth: true, permission: 'event.review' }, (p, ctx) =>
      handlers.upcoming(p, ctx),
    );
    const result = await dispatch(
      {
        action: 'events.upcoming',
        organizationId: 'org_123456',
        auth: { sessionToken: SESSION_TOKEN },
        payload: { days: 14 },
      },
      { repo, audit },
    );
    const evs = (result as { events: Array<{ id: string }> }).events;
    expect(evs.map((e) => e.id)).toEqual(['ev_aaa']);
  });

  it('events.upcoming rejects days out of range', async () => {
    const repo = fakeRepo();
    const audit = makeAuditService(repo, silentLogger);
    const { makeEventsHandlers } = await import('../src/events/handlers.js');
    const handlers = makeEventsHandlers({ repo });
    register('events.upcoming', { auth: true, permission: 'event.review' }, (p, ctx) =>
      handlers.upcoming(p, ctx),
    );
    await expect(
      dispatch(
        {
          action: 'events.upcoming',
          organizationId: 'org_123456',
          auth: { sessionToken: SESSION_TOKEN },
          payload: { days: 999 },
        },
        { repo, audit },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
