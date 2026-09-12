import { describe, expect, it } from 'vitest';
import {
  isNotificationKind,
  NOTIFICATION_KINDS,
  notificationIcon,
  notificationKindLabel,
  notificationLinkFor,
  type NotificationDto,
} from './notifications';

const base: NotificationDto = {
  id: 'n1',
  organizationId: 'org-1',
  kind: 'REQUEST_APPROVED',
  title: 'Solicitud aprobada',
  body: 'Tu pedido de sonido fue aprobado.',
  link: '',
  entityType: '',
  entityId: '',
  read: false,
  createdAt: '2026-09-14T12:00:00.000Z',
  version: 1,
};

describe('notificationKindLabel', () => {
  it('returns a Spanish label for every known kind', () => {
    for (const kind of NOTIFICATION_KINDS) {
      const label = notificationKindLabel(kind);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('labels REQUEST_APPROVED, REQUEST_REJECTED, and MAINTENANCE_OPENED distinctly', () => {
    expect(notificationKindLabel('REQUEST_APPROVED')).not.toBe(
      notificationKindLabel('REQUEST_REJECTED'),
    );
    expect(notificationKindLabel('REQUEST_REJECTED')).not.toBe(
      notificationKindLabel('MAINTENANCE_OPENED'),
    );
  });
});

describe('notificationIcon', () => {
  it('returns a non-empty string for every known kind', () => {
    for (const kind of NOTIFICATION_KINDS) {
      const icon = notificationIcon(kind);
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    }
  });

  it('falls back to a neutral icon name for unknown kinds', () => {
    expect(notificationIcon('OTHER')).toBe('Notifications');
  });
});

describe('notificationLinkFor', () => {
  it('prefers the server-supplied link when it is a relative path', () => {
    expect(notificationLinkFor({ ...base, link: '/requests/r1' })).toBe('/requests/r1');
  });

  it('ignores absolute URLs to prevent open redirects', () => {
    const link = notificationLinkFor({ ...base, link: 'https://evil.example' });
    expect(link.startsWith('/')).toBe(true);
    expect(link).not.toContain('evil');
  });

  it('derives a route from entityType when the server omits the link', () => {
    expect(notificationLinkFor({ ...base, link: '', entityType: 'Request', entityId: 'r1' })).toBe(
      '/requests/r1',
    );
    expect(
      notificationLinkFor({ ...base, link: '', entityType: 'Maintenance', entityId: 'm1' }),
    ).toBe('/maintenance/m1');
    expect(notificationLinkFor({ ...base, link: '', entityType: 'Purchase', entityId: 'p1' })).toBe(
      '/purchases/p1',
    );
    expect(notificationLinkFor({ ...base, link: '', entityType: 'Delivery', entityId: 'd1' })).toBe(
      '/deliveries/d1',
    );
  });

  it('falls back to a list page when entityId is missing', () => {
    expect(notificationLinkFor({ ...base, link: '', entityType: 'Request', entityId: '' })).toBe(
      '/requests',
    );
  });

  it('falls back to /notifications for unknown entity types', () => {
    expect(notificationLinkFor({ ...base, link: '', entityType: 'Mystery', entityId: 'x' })).toBe(
      '/notifications',
    );
  });
});

describe('isNotificationKind', () => {
  it('accepts every constant kind', () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(isNotificationKind(kind)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isNotificationKind('UNKNOWN')).toBe(false);
    expect(isNotificationKind('')).toBe(false);
  });
});
