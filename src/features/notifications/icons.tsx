/**
 * Icon mapping for notification kinds. Kept separate from the domain
 * module so the domain stays free of MUI imports.
 */
import type { SvgIconProps } from '@mui/material';
import {
  Build,
  Cancel,
  CheckCircle,
  Event,
  Inbox,
  LocalShipping,
  Notifications as NotificationsIcon,
  ReportProblem,
  ShoppingCart,
} from '@mui/icons-material';
import type { NotificationKind } from '../../domain/notifications';

type IconComponent = React.ComponentType<SvgIconProps>;

const ICON_MAP: Record<NotificationKind, IconComponent> = {
  REQUEST_SUBMITTED: Inbox,
  REQUEST_APPROVED: CheckCircle,
  REQUEST_REJECTED: Cancel,
  MAINTENANCE_OPENED: Build,
  DELIVERY_CREATED: LocalShipping,
  RETURN_DAMAGED: ReportProblem,
  PURCHASE_DECISION: ShoppingCart,
  EVENT_REMINDER: Event,
  OTHER: NotificationsIcon,
};

export function iconFor(kind: NotificationKind): IconComponent {
  return ICON_MAP[kind] ?? NotificationsIcon;
}
