/**
 * NotificationBell — the AppBar replacement for the placeholder badge.
 * Click opens the NotificationsCenter popover. The unread count polls
 * every 30s while the user is authenticated.
 */
import { useState } from 'react';
import { Badge, IconButton, Tooltip } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useAuth } from '../../integrations/auth';
import { useUnreadCount } from '../../integrations/data';
import { NotificationsCenter } from './NotificationsCenter';

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { data: unread = 0 } = useUnreadCount({ enabled: isAuthenticated });

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);
  const label = unread > 0 ? `${unread} notificación${unread === 1 ? '' : 'es'}` : 'Notificaciones';

  if (!isAuthenticated) {
    return (
      <Tooltip title="Iniciá sesión para ver notificaciones">
        <span>
          <IconButton aria-label="Notificaciones" disabled>
            <NotificationsIcon />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title={label}>
        <IconButton aria-label={label} onClick={handleOpen} data-testid="notification-bell">
          <Badge badgeContent={unread} color="error" max={99} invisible={unread === 0}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <NotificationsCenter open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleClose} />
    </>
  );
}
