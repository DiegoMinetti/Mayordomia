import { useCallback, useMemo } from 'react';
import { ArrowBack, Event, Group, Rule } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useLocation, useReservations, type ReservationDto } from '../../integrations/data';
import { reservationStatusLabel } from '../../domain/resource';

function formatRange(r: ReservationDto) {
  const start = new Date(r.startAt);
  const end = new Date(r.endAt);
  const fmt = (d: Date) => d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  return `${fmt(start)} → ${fmt(end)}`;
}

export function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation(id);
  const reservations = useReservations({ targetId: id, kind: 'LOCATION' });

  const upcoming = useMemo(
    () =>
      (reservations.data ?? [])
        .filter((r) => new Date(r.endAt).getTime() > Date.now() && r.status !== 'CANCELLED')
        .slice(0, 5),
    [reservations.data],
  );

  const handleReserve = useCallback(() => {
    // Placeholder for the reservation wizard (PR 1C/2).
    if (typeof window !== 'undefined') {
      console.info('[locations] reservar solicitado', { id });
    }
  }, [id]);

  if (location.isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" height={48} width="60%" />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  if (!location.data) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning">No encontramos este espacio.</Alert>
        <Button component={RouterLink} to="/locations" startIcon={<ArrowBack />}>
          Volver a espacios
        </Button>
      </Stack>
    );
  }

  const l = location.data;

  return (
    <Stack spacing={3}>
      <Button
        component={RouterLink}
        to="/locations"
        startIcon={<ArrowBack />}
        size="small"
        variant="text"
        sx={{ alignSelf: 'flex-start' }}
      >
        Volver
      </Button>

      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={l.active ? 'success' : 'default'}
            label={l.active ? 'Activo' : 'Inactivo'}
          />
          {typeof l.capacity === 'number' ? (
            <Chip
              size="small"
              variant="outlined"
              icon={<Group />}
              label={`Capacidad ${l.capacity}`}
            />
          ) : null}
        </Stack>
        <Typography variant="h1" mt={1}>
          {l.name}
        </Typography>
        {l.description ? <Typography color="text.secondary">{l.description}</Typography> : null}
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Rule color="primary" />
              <Typography variant="h2">Reglas</Typography>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            {l.rules ? (
              <Typography whiteSpace="pre-wrap">{l.rules}</Typography>
            ) : (
              <Typography color="text.secondary">Sin reglas especiales registradas.</Typography>
            )}
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Event color="primary" />
              <Typography variant="h2">Próximas reservas</Typography>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            {upcoming.length === 0 ? (
              <Typography color="text.secondary">Sin reservas próximas.</Typography>
            ) : (
              <Stack spacing={1}>
                {upcoming.map((r) => (
                  <Stack
                    key={r.id}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ borderTop: '1px solid #eee', py: 1 }}
                  >
                    <Box>
                      <Typography fontWeight={700}>{formatRange(r)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Solicitud: {r.requestId}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={reservationStatusLabel(r.status)}
                      color={r.status === 'CONFIRMED' ? 'success' : 'warning'}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h2">Calendario</Typography>
              <Typography color="text.secondary" variant="body2">
                La vista de agenda unificada se habilita en PR 1C.
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleReserve}>
              Reservar
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
