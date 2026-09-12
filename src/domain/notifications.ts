/**
 * Notifications — domain types and helpers for the in-app notification
 * center (PR 3C).
 *
 * These mirror the JSON envelope returned by the Apps Script gateway and
 * provide pure helpers for the UI to:
 *   - map a kind to a human label (Spanish) and an icon
 *   - resolve a notification's entity back to an in-app route
 *
 * No React/MUI imports here on purpose: this module is consumed by the
 * domain layer and unit-tested in isolation.
 */

export type NotificationKind =
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'MAINTENANCE_OPENED'
  | 'DELIVERY_CREATED'
  | 'RETURN_DAMAGED'
  | 'PURCHASE_DECISION'
  | 'EVENT_REMINDER'
  | 'OTHER';

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'REQUEST_SUBMITTED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'MAINTENANCE_OPENED',
  'DELIVERY_CREATED',
  'RETURN_DAMAGED',
  'PURCHASE_DECISION',
  'EVENT_REMINDER',
  'OTHER',
];

export interface NotificationDto {
  id: string;
  organizationId: string;
  userId?: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
  version: number;
}

export interface NotificationFilters {
  unreadOnly?: boolean;
  kinds?: NotificationKind[];
  since?: string;
  until?: string;
  limit?: number;
}

const KIND_LABELS: Record<NotificationKind, string> = {
  REQUEST_SUBMITTED: 'Solicitud recibida',
  REQUEST_APPROVED: 'Solicitud aprobada',
  REQUEST_REJECTED: 'Solicitud rechazada',
  MAINTENANCE_OPENED: 'Mantenimiento abierto',
  DELIVERY_CREATED: 'Entrega creada',
  RETURN_DAMAGED: 'Devolución con daños',
  PURCHASE_DECISION: 'Decisión de compra',
  EVENT_REMINDER: 'Recordatorio de evento',
  OTHER: 'Notificación',
};

/**
 * MUI icon name as a string. The component layer maps this to a real icon
 * import — keeping this module free of MUI imports.
 */
const KIND_ICONS: Record<NotificationKind, string> = {
  REQUEST_SUBMITTED: 'Inbox',
  REQUEST_APPROVED: 'CheckCircle',
  REQUEST_REJECTED: 'Cancel',
  MAINTENANCE_OPENED: 'Build',
  DELIVERY_CREATED: 'LocalShipping',
  RETURN_DAMAGED: 'ReportProblem',
  PURCHASE_DECISION: 'ShoppingCart',
  EVENT_REMINDER: 'Event',
  OTHER: 'Notifications',
};

export function notificationKindLabel(kind: NotificationKind): string {
  return KIND_LABELS[kind] ?? 'Notificación';
}

export function notificationIcon(kind: NotificationKind): string {
  return KIND_ICONS[kind] ?? 'Notifications';
}

/**
 * Resolves a notification into an in-app route. Prefers the server-supplied
 * `link` (which the gateway can keep as an opaque path); falls back to a
 * best-effort mapping based on the entity type so client-rendered lists
 * still navigate when the server omits the link.
 */
export function notificationLinkFor(notification: NotificationDto): string {
  const link = notification.link?.trim();
  if (link) {
    // Only allow relative paths to avoid open-redirect on unsanitized links.
    if (link.startsWith('/')) return link;
  }
  switch (notification.entityType) {
    case 'Request':
      return notification.entityId ? `/requests/${notification.entityId}` : '/requests';
    case 'Maintenance':
      return notification.entityId ? `/maintenance/${notification.entityId}` : '/maintenance';
    case 'Delivery':
      return notification.entityId ? `/deliveries/${notification.entityId}` : '/deliveries';
    case 'Purchase':
      return notification.entityId ? `/purchases/${notification.entityId}` : '/purchases';
    case 'Event':
      return notification.entityId ? `/events/${notification.entityId}` : '/agenda';
    default:
      return '/notifications';
  }
}

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}
