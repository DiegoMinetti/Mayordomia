/**
 * NotificationsPage — the full-page view of the caller's notifications.
 * Mirrors the popover but in a `Card` and with a wider body. Available
 * behind `/notifications` for users who want the longer history.
 */
import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DoneAll, MarkEmailRead, Notifications as NotificationsIcon } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useMarkAllRead, useMarkRead, useMyNotifications } from '../../integrations/data';
import { notificationLinkFor } from '../../domain/notifications';
import { iconFor } from './icons';

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useMyNotifications({ limit: 100 });
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleClick = (id: string, link: string) => {
    setBusyId(id);
    markRead.mutate([id], {
      onSettled: () => {
        setBusyId((cur) => (cur === id ? null : cur));
        navigate(link);
      },
    });
  };

  const unread = data?.filter((n) => !n.read).length ?? 0;

  return (
    <Stack spacing={3} sx={{ maxWidth: 800, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h1">Notificaciones</Typography>
          <Typography color="text.secondary">
            Tu centro de avisos. {unread > 0 ? `Tenés ${unread} sin leer.` : 'Estás al día.'}
          </Typography>
        </Box>
        <Tooltip title="Marcar todo como leído">
          <span>
            <Button
              startIcon={<DoneAll />}
              variant="outlined"
              size="small"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || unread === 0}
            >
              Marcar todo leído
            </Button>
          </span>
        </Tooltip>
      </Stack>
      <Card>
        <CardContent sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
              <CircularProgress />
            </Box>
          ) : isError ? (
            <Stack alignItems="center" spacing={1} sx={{ p: 4 }}>
              <Typography color="error">No se pudieron cargar las notificaciones.</Typography>
              <Button onClick={() => void refetch()}>Reintentar</Button>
            </Stack>
          ) : !data?.length ? (
            <Stack alignItems="center" spacing={1} sx={{ p: 6 }}>
              <NotificationsIcon color="disabled" fontSize="large" />
              <Typography color="text.secondary">Sin notificaciones por ahora.</Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {data.map((n, idx) => {
                const Icon = iconFor(n.kind);
                const link = notificationLinkFor(n);
                return (
                  <Box key={n.id}>
                    {idx > 0 && <Divider />}
                    <ListItem
                      data-testid={`notification-row-${n.id}`}
                      disablePadding
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
                                    onSettled: () =>
                                      setBusyId((cur) => (cur === n.id ? null : cur)),
                                  });
                                }}
                              >
                                <MarkEmailRead />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : null
                      }
                    >
                      <ListItemButton
                        onClick={() => handleClick(n.id, link)}
                        sx={{ alignItems: 'flex-start', gap: 1.5, py: 1.5 }}
                      >
                        <Icon color={n.read ? 'disabled' : 'primary'} sx={{ mt: 0.5 }} />
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography fontWeight={n.read ? 500 : 700}>{n.title}</Typography>
                              {!n.read && <Chip label="Nueva" size="small" color="primary" />}
                            </Stack>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                          secondary={
                            <Stack spacing={0.5} mt={0.5}>
                              {n.body && <Typography color="text.secondary">{n.body}</Typography>}
                              <Typography variant="caption" color="text.secondary">
                                {relativeTime(n.createdAt)}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
