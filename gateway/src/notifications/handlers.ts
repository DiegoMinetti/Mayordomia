/**
 * Notifications read endpoints. PR 4 covers listMine + unreadCount only.
 * Mutations (markRead, markAllRead, publish) come in PR 5.
 */
import { object } from '../validation.js';
import type { Repository } from '../repository/index.js';
import type { DispatchContext } from '../router/index.js';

export interface NotificationsHandlersDeps {
  repo: Repository;
}

function isTruthy(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'string') return v === 'true' || v === '1';
  if (typeof v === 'number') return v !== 0;
  return false;
}

function toDto(r: Record<string, unknown>) {
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    userId: r['userId'] ? String(r['userId']) : undefined,
    kind: String(r['kind'] ?? 'OTHER'),
    title: String(r['title'] ?? ''),
    body: r['body'] ? String(r['body']) : '',
    link: r['link'] ? String(r['link']) : '',
    entityType: r['entityType'] ? String(r['entityType']) : '',
    entityId: r['entityId'] ? String(r['entityId']) : '',
    read: isTruthy(r['read']),
    createdAt: String(r['createdAt'] ?? ''),
    version: Number(r['version'] ?? 1),
  };
}

function isOrgWide(r: Record<string, unknown>): boolean {
  return !r['userId'] || String(r['userId']) === '';
}

export function makeNotificationsHandlers(deps: NotificationsHandlersDeps) {
  async function listMine(_payload: Record<string, unknown>, ctx: DispatchContext) {
    object(_payload, 'payload');
    const userId = String(ctx.auth!.user['id']);
    const orgId = ctx.auth!.organizationId;
    let rows = (await deps.repo.rows('Notifications')).filter(
      (r) => String(r['organizationId']) === orgId,
    );
    rows = rows.filter((r) => isOrgWide(r) || String(r['userId']) === userId);
    rows.sort((a, b) => String(b['createdAt']).localeCompare(String(a['createdAt'])));
    const limit = Math.min(rows.length, 50);
    return { notifications: rows.slice(0, limit).map(toDto) };
  }

  async function unreadCount(_payload: Record<string, unknown>, ctx: DispatchContext) {
    object(_payload, 'payload');
    const userId = String(ctx.auth!.user['id']);
    const orgId = ctx.auth!.organizationId;
    const rows = (await deps.repo.rows('Notifications'))
      .filter((r) => String(r['organizationId']) === orgId)
      .filter((r) => isOrgWide(r) || String(r['userId']) === userId)
      .filter((r) => !isTruthy(r['read']));
    return { count: rows.length };
  }

  return { listMine, unreadCount };
}

export type NotificationsHandlers = ReturnType<typeof makeNotificationsHandlers>;
