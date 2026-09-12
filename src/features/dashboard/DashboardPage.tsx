import { ArrowForward, Event, Notifications, TaskAlt } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../integrations/auth/useAuth';
import { useCurrentOrg } from '../../integrations/org/CurrentOrgContext';
import {
  useMaintenanceList,
  useMyNotifications,
  usePurchaseRequests,
  useRequests,
  useUpcomingEvents,
} from '../../integrations/data/hooks';
import { modules } from '../../app/demoData';

type AttentionLevel = 'CRITICAL' | 'HIGH' | 'NORMAL';

interface AttentionItem {
  level: AttentionLevel;
  title: string;
  detail: string;
  path: string;
}

function formatGreetingDate(d: Date): string {
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();

  // Live attention counters. Each query is gated on organizationId being present.
  const pendingRequests = useRequests({ status: 'PENDING' }, !!organizationId);
  const areaApprovals = useRequests({ status: 'PENDING_AREA_APPROVAL' }, !!organizationId);
  const generalApprovals = useRequests({ status: 'PENDING_GENERAL_APPROVAL' }, !!organizationId);
  const openMaintenance = useMaintenanceList({ status: 'OPEN' }, !!organizationId);
  const purchaseSubmissions = usePurchaseRequests({ status: 'SUBMITTED' }, !!organizationId);
  const upcoming = useUpcomingEvents(7, !!organizationId);
  const unreadNotifications = useMyNotifications({ unreadOnly: true }, !!organizationId);

  const greetingName = useMemo(() => {
    const n = user?.name?.split(' ')[0];
    return n && n.length > 0 ? n : 'equipo';
  }, [user?.name]);

  const attention: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    const generalCount = generalApprovals.data?.length ?? 0;
    if (generalCount > 0) {
      items.push({
        level: 'CRITICAL',
        title: `${generalCount} solicitud${generalCount > 1 ? 'es' : ''} esperando aprobación general`,
        detail: 'Requieren tu firma antes de poder avanzar.',
        path: '/requests',
      });
    }
    const areaCount = areaApprovals.data?.length ?? 0;
    if (areaCount > 0) {
      items.push({
        level: 'HIGH',
        title: `${areaCount} solicitud${areaCount > 1 ? 'es' : ''} en aprobación de área`,
        detail: 'Pasaron el primer filtro; falta el visto bueno del líder.',
        path: '/requests',
      });
    }
    const pendingCount = pendingRequests.data?.length ?? 0;
    if (pendingCount > 0) {
      items.push({
        level: 'NORMAL',
        title: `${pendingCount} solicitud${pendingCount > 1 ? 'es' : ''} en borrador / pendientes`,
        detail: 'Aún sin iniciar el circuito de aprobación.',
        path: '/requests',
      });
    }
    const openMnt = openMaintenance.data?.length ?? 0;
    if (openMnt > 0) {
      items.push({
        level: openMnt > 3 ? 'HIGH' : 'NORMAL',
        title: `${openMnt} mantenimiento${openMnt > 1 ? 's' : ''} abierto${openMnt > 1 ? 's' : ''}`,
        detail: 'Fallas reportadas pendientes de diagnóstico.',
        path: '/maintenance',
      });
    }
    const subPurchases = purchaseSubmissions.data?.length ?? 0;
    if (subPurchases > 0) {
      items.push({
        level: 'NORMAL',
        title: `${subPurchases} compra${subPurchases > 1 ? 's' : ''} para evaluar`,
        detail: 'Cotizaciones recibidas; falta decidir.',
        path: '/purchases',
      });
    }
    return items;
  }, [
    pendingRequests.data,
    areaApprovals.data,
    generalApprovals.data,
    openMaintenance.data,
    purchaseSubmissions.data,
  ]);

  const todayEvent = useMemo(() => {
    const list = upcoming.data ?? [];
    return list.find((e) => isToday(e.startAt)) ?? list[0];
  }, [upcoming.data]);

  const unreadCount = unreadNotifications.data?.length ?? 0;
  const loading =
    pendingRequests.isLoading ||
    areaApprovals.isLoading ||
    generalApprovals.isLoading ||
    openMaintenance.isLoading ||
    purchaseSubmissions.isLoading ||
    upcoming.isLoading;

  if (!organizationId) {
    return (
      <Stack spacing={2}>
        <Alert severity="info">Seleccioná una organización para ver el panel.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography color="primary" fontWeight={700}>
          {formatGreetingDate(new Date())}
        </Typography>
        <Typography variant="h1">Buen día, {greetingName}</Typography>
        <Typography color="text.secondary">
          {attention.length > 0
            ? 'Esto requiere atención ahora.'
            : 'No hay nada urgente. Buen momento para planificar.'}
        </Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h2">Requiere atención</Typography>
                {loading ? (
                  <CircularProgress size={16} />
                ) : (
                  <Chip label={attention.length} color="error" size="small" />
                )}
              </Stack>
              <Stack mt={2}>
                {attention.length === 0 && !loading && (
                  <Box py={2} textAlign="center">
                    <Typography color="text.secondary">No hay elementos pendientes. 🎉</Typography>
                  </Box>
                )}
                {attention.map((item) => (
                  <Button
                    key={item.title}
                    component={Link}
                    to={item.path}
                    color="inherit"
                    sx={{
                      justifyContent: 'space-between',
                      py: 1.5,
                      borderTop: '1px solid #eee',
                    }}
                    endIcon={<ArrowForward />}
                  >
                    <Box textAlign="left">
                      <Chip
                        label={item.level}
                        color={item.level === 'CRITICAL' ? 'error' : 'warning'}
                        size="small"
                      />
                      <Typography fontWeight={700}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.detail}
                      </Typography>
                    </Box>
                  </Button>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack gap={2}>
            <Card>
              <CardContent>
                <Event color="primary" />
                <Typography variant="h2">Próximo evento</Typography>
                {todayEvent ? (
                  <>
                    <Typography mt={1}>
                      {formatEventTime(todayEvent.startAt)} · {todayEvent.name}
                    </Typography>
                    <Typography color="text.secondary">
                      {todayEvent.siteId
                        ? `Sede ${String(todayEvent.siteId)}`
                        : 'Sin sede asignada'}
                    </Typography>
                  </>
                ) : (
                  <Typography color="text.secondary" mt={1}>
                    No hay eventos próximos.
                  </Typography>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Notifications color="secondary" />
                  <Typography variant="h2">Notificaciones</Typography>
                  {unreadCount > 0 && <Chip label={unreadCount} color="secondary" size="small" />}
                </Stack>
                <Typography mt={1}>
                  {unreadCount > 0
                    ? `${unreadCount} sin leer`
                    : 'Estás al día con las notificaciones.'}
                </Typography>
                <Button
                  component={Link}
                  to="/notifications"
                  size="small"
                  sx={{ mt: 1 }}
                  endIcon={<TaskAlt />}
                >
                  Ver todas
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
      <Box>
        <Typography variant="h2" mb={2}>
          Centro operativo
        </Typography>
        <Grid container spacing={2}>
          {modules.map(([name, desc, path]) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={name}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={Link} to={path} sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography fontWeight={750} fontSize="1.05rem">
                      {name}
                    </Typography>
                    <Typography color="text.secondary" mt={0.5}>
                      {desc}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
}
