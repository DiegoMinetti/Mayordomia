/**
 * NotificationsCenter — the popover that lists the caller's notifications.
 *
 * Reads from `useMyNotifications` (TanStack Query), with manual polling
 * (30s) so the list stays fresh while the popover is open. The bell
 * already polls the unread count separately; opening this popover should
 * not double-fetch the same data more than once per interval.
 */
import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close,
  DoneAll,
  MarkEmailRead,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useMarkAllRead, useMarkRead, useMyNotifications } from '../../integrations/data';
import type { NotificationDto } from '../../integrations/data';
import { notificationKindLabel, notificationLinkFor } from '../../domain/notifications';
import { iconFor } from './icons';

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

export interface NotificationsCenterProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export function NotificationsCenter({ open, anchorEl, onClose }: NotificationsCenterProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useMyNotifications({ limit: 50 }, true);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleClick = (n: NotificationDto) => {
    if (!n.read) {
      setBusyId(n.id);
      markRead.mutate([n.id], {
        onSettled: () => setBusyId((cur) => (cur === n.id ? null : cur)),
      });
    }
    onClose();
    const path = notificationLinkFor(n);
    if (path) navigate(path);
  };

  const handleMarkAll = () => {
    markAll.mutate();
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: { sx: { width: { xs: 320, sm: 400 }, maxHeight: 520, p: 0 } },
      }}
      data-testid="notifications-center"
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5 }}
      >
        <Typography variant="h2" fontSize="1.05rem">
          Notificaciones
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Marcar todo como leído">
            <span>
              <IconButton
                size="small"
                onClick={handleMarkAll}
                disabled={markAll.isPending || !data?.some((n) => !n.read)}
                aria-label="Marcar todo como leído"
              >
                <DoneAll fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Cerrar">
            <IconButton size="small" onClick={onClose} aria-label="Cerrar">
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Divider />
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : isError ? (
        <Stack alignItems="center" spacing={1} sx={{ p: 3 }}>
          <Typography color="error" variant="body2">
            No se pudieron cargar las notificaciones.
          </Typography>
          <Button size="small" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </Stack>
      ) : !data?.length ? (
        <Stack alignItems="center" spacing={1} sx={{ p: 4 }}>
          <NotificationsIcon color="disabled" />
          <Typography color="text.secondary" variant="body2">
            Sin notificaciones por ahora.
          </Typography>
        </Stack>
      ) : (
        <List dense disablePadding sx={{ maxHeight: 440, overflowY: 'auto' }}>
          {data.map((n) => {
            const Icon = iconFor(n.kind);
            return (
              <ListItem
                key={n.id}
                disablePadding
                data-testid={`notification-row-${n.id}`}
                secondaryAction={
                  !n.read ? (
                    <Tooltip title="Marcar como leída">
                      <span>
                        <IconButton
                          edge="end"
                          size="small"
                          disabled={busyId === n.id && markRead.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            setBusyId(n.id);
                            markRead.mutate([n.id], {
                              onSettled: () => setBusyId((cur) => (cur === n.id ? null : cur)),
                            });
                          }}
                          aria-label="Marcar como leída"
                        >
                          <MarkEmailRead fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null
                }
              >
                <ListItemButton
                  onClick={() => handleClick(n)}
                  sx={{
                    alignItems: 'flex-start',
                    gap: 1.5,
                    background: n.read ? 'transparent' : 'action.hover',
                  }}
                >
                  <Icon
                    fontSize="small"
                    color={n.read ? 'disabled' : 'primary'}
                    sx={{ mt: 0.25 }}
                  />
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={n.read ? 500 : 700} fontSize="0.95rem">
                          {n.title || notificationKindLabel(n.kind)}
                        </Typography>
                        {!n.read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: 'primary.main',
                            }}
                            aria-label="No leída"
                          />
                        )}
                      </Stack>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <Stack spacing={0.25} mt={0.25}>
                        {n.body && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {n.body}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {relativeTime(n.createdAt)}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
          {isFetching && !isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={16} />
            </Box>
          )}
        </List>
      )}
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button
          size="small"
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
        >
          Ver todas
        </Button>
      </Box>
    </Popover>
  );
}
