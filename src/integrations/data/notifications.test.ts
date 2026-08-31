import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './GatewayClient';
import { NotificationsDataClient } from './NotificationsDataClient';
import type { NotificationDto } from './types';

function installFetchMock(responder: (action: string, payload: unknown) => unknown) {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { action: string; payload: unknown };
    return { json: async () => responder(body.action, body.payload) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const orgId = 'org-1';
const notif: NotificationDto = {
  id: 'n1',
  organizationId: orgId,
  kind: 'REQUEST_APPROVED',
  title: 'Aprobada',
  body: 'Sonido aprobado',
  link: '/requests/r1',
  entityType: 'Request',
  entityId: 'r1',
  read: false,
  createdAt: '2026-09-14T12:00:00.000Z',
  version: 1,
};

function makeClient(responder: (action: string, payload: unknown) => unknown) {
  installFetchMock(responder);
  return new NotificationsDataClient(
    new GatewayClient({
      appsScriptUrl: 'https://example.com/exec',
      getAccessToken: vi.fn().mockResolvedValue('tok'),
    }),
    { organizationId: orgId },
  );
}

describe('NotificationsDataClient (real fetch path)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listMyNotifications returns the gateway payload', async () => {
    const client = makeClient((action, payload) => {
      expect(action).toBe('notifications.listMine');
      const p = payload as { unreadOnly?: boolean; kinds?: string; limit?: number };
      expect(p.unreadOnly).toBe(true);
      expect(p.kinds).toBe('REQUEST_APPROVED,REQUEST_REJECTED');
      expect(p.limit).toBe(25);
      return { ok: true, data: { notifications: [notif] } };
    });
    const list = await client.listMyNotifications({
      unreadOnly: true,
      kinds: ['REQUEST_APPROVED', 'REQUEST_REJECTED'],
      limit: 25,
    });
    expect(list).toEqual([notif]);
  });

  it('listMyNotifications returns [] when the gateway reports an error', async () => {
    const client = makeClient(() => ({
      ok: false,
      error: { code: 'NETWORK', message: 'oops' },
    }));
    const list = await client.listMyNotifications();
    expect(list).toEqual([]);
  });

  it('markRead posts the ids and returns the updated count', async () => {
    const client = makeClient((action, payload) => {
      expect(action).toBe('notifications.markRead');
      const p = payload as { ids: string[] };
      expect(p.ids).toEqual(['n1', 'n2']);
      return { ok: true, data: { updated: 2 } };
    });
    const updated = await client.markRead(['n1', 'n2']);
    expect(updated).toBe(2);
  });

  it('markRead returns 0 when called with no ids (no request fired)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new NotificationsDataClient(
      new GatewayClient({
        appsScriptUrl: 'https://example.com/exec',
        getAccessToken: vi.fn().mockResolvedValue('tok'),
      }),
      { organizationId: orgId },
    );
    const updated = await client.markRead([]);
    expect(updated).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('markAllRead returns the updated count', async () => {
    const client = makeClient((action) => {
      expect(action).toBe('notifications.markAllRead');
      return { ok: true, data: { updated: 5 } };
    });
    const updated = await client.markAllRead();
    expect(updated).toBe(5);
  });

  it('unreadCount returns 0 on error and the count on success', async () => {
    const errorClient = makeClient(() => ({
      ok: false,
      error: { code: 'NETWORK', message: 'x' },
    }));
    expect(await errorClient.unreadCount()).toBe(0);

    const okClient = makeClient((action) => {
      expect(action).toBe('notifications.unreadCount');
      return { ok: true, data: { count: 7 } };
    });
    expect(await okClient.unreadCount()).toBe(7);
  });
});
