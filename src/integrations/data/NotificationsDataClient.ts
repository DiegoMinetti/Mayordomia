/**
 * NotificationsDataClient — typed wrapper for the `notifications.*` gateway
 * actions. Mirrors the catalog pattern in `DataClient` so the same auth +
 * org routing applies. All calls require an authenticated org context; the
 * server scopes results to the caller.
 */
import type { GatewayClient } from './GatewayClient';
import type { NotificationDto, NotificationListFilters } from './types';

export interface NotificationsDataClientOptions {
  organizationId: string;
}

export interface NotificationListResult {
  notifications: NotificationDto[];
}

export interface NotificationMutateResult {
  updated: number;
}

export interface NotificationUnreadResult {
  count: number;
}

export class NotificationsDataClient {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly opts: NotificationsDataClientOptions,
  ) {}

  async listMyNotifications(filters: NotificationListFilters = {}): Promise<NotificationDto[]> {
    const payload: Record<string, unknown> = {};
    if (filters.unreadOnly) payload['unreadOnly'] = true;
    if (filters.kinds?.length) payload['kinds'] = filters.kinds.join(',');
    if (filters.since) payload['since'] = filters.since;
    if (filters.until) payload['until'] = filters.until;
    if (typeof filters.limit === 'number') payload['limit'] = filters.limit;
    const res = await this.gateway.call<NotificationListResult>(
      'notifications.listMine',
      this.opts.organizationId,
      payload,
    );
    if (!res.ok) return [];
    return res.data.notifications ?? [];
  }

  async markRead(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const res = await this.gateway.call<NotificationMutateResult>(
      'notifications.markRead',
      this.opts.organizationId,
      { ids },
    );
    if (!res.ok) return 0;
    return res.data.updated ?? 0;
  }

  async markAllRead(): Promise<number> {
    const res = await this.gateway.call<NotificationMutateResult>(
      'notifications.markAllRead',
      this.opts.organizationId,
      {},
    );
    if (!res.ok) return 0;
    return res.data.updated ?? 0;
  }

  async unreadCount(): Promise<number> {
    const res = await this.gateway.call<NotificationUnreadResult>(
      'notifications.unreadCount',
      this.opts.organizationId,
      {},
    );
    if (!res.ok) return 0;
    return res.data.count ?? 0;
  }
}
