import { useMemo, useState } from 'react';
import { CalendarMonth, ChevronLeft, ChevronRight, Event, Place } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  formatEventRange,
  groupByDay,
  isOngoing,
  isPast,
  isUpcoming,
  type EventDto,
  type EventStatus,
} from '../../domain/event';
import { useSites, useUpcomingEvents } from '../../integrations/data';

const STATUS_COLORS: Record<EventStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> =
  {
    DRAFT: 'default',
    PUBLISHED: 'success',
    CANCELLED: 'error',
    COMPLETED: 'primary',
  };

export function AgendaPage() {
  const [daysAhead, setDaysAhead] = useState<7 | 14 | 30>(14);
  const [showPast, setShowPast] = useState(false);
  const eventsQuery = useUpcomingEvents(daysAhead);
  const sites = useSites();

  const buckets = useMemo(() => {
    const events = eventsQuery.data ?? [];
    const filtered = showPast ? events : events.filter((e) => !isPast(e));
    return groupByDay(filtered);
  }, [eventsQuery.data, showPast]);

  const ongoing = useMemo(
    () => (eventsQuery.data ?? []).filter((e) => isOngoing(e)),
    [eventsQuery.data],
  );
  const upcoming = useMemo(
    () => (eventsQuery.data ?? []).filter((e) => isUpcoming(e)),
    [eventsQuery.data],
  );

  return (
    <Stack spacing={3}>
      <Box>
        <Typography color="primary" fontWeight={700}>
          Agenda
        </Typography>
        <Typography variant="h1">Lo que viene</Typography>
        <Typography color="text.secondary">
          Próximos eventos, en curso y programados. Mantené la operación coordinada sin abrir cada
          detalle.
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={daysAhead}
          onChange={(_, v) => v && setDaysAhead(v)}
          aria-label="Horizonte"
        >
          <ToggleButton value={7}>7 días</ToggleButton>
          <ToggleButton value={14}>14 días</ToggleButton>
          <ToggleButton value={30}>30 días</ToggleButton>
        </ToggleButtonGroup>
        <Box flex={1} />
        <Button
          size="small"
          variant={showPast ? 'contained' : 'outlined'}
          onClick={() => setShowPast((s) => !s)}
        >
          {showPast ? 'Mostrando pasados' : 'Incluir pasados'}
        </Button>
      </Stack>
      {ongoing.length > 0 && (
        <Card sx={{ borderLeft: 4, borderColor: 'warning.main' }}>
          <CardContent>
            <Stack direction="row" gap={1} alignItems="center">
              <Event color="warning" />
              <Typography variant="h2">En curso ahora</Typography>
            </Stack>
            <Stack gap={1} mt={1.5}>
              {ongoing.map((e) => (
                <AgendaRow
                  key={e.id}
                  event={e}
                  siteName={sites.data?.find((s) => s.id === e.siteId)?.name}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
      {eventsQuery.isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress aria-label="Cargando agenda" />
        </Box>
      ) : eventsQuery.isError ? (
        <Alert severity="error">No pudimos cargar la agenda. Probá de nuevo en unos minutos.</Alert>
      ) : buckets.length === 0 ? (
        <EmptyState hasUpcoming={upcoming.length > 0} />
      ) : (
        <Stack gap={2}>
          {buckets.map((bucket) => (
            <Box key={bucket.key}>
              <Stack direction="row" alignItems="center" gap={1}>
                <CalendarMonth color="primary" fontSize="small" />
                <Typography variant="h2">{bucket.label}</Typography>
                <Chip size="small" label={`${bucket.events.length}`} />
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack gap={1}>
                {bucket.events.map((e) => (
                  <AgendaRow
                    key={e.id}
                    event={e}
                    siteName={sites.data?.find((s) => s.id === e.siteId)?.name}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" gap={2} justifyContent="space-between" alignItems="center">
        <IconButton aria-label="Anterior" disabled>
          <ChevronLeft />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          {eventsQuery.data?.length ?? 0} eventos en los próximos {daysAhead} días
        </Typography>
        <IconButton aria-label="Siguiente" disabled>
          <ChevronRight />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function AgendaRow({ event, siteName }: { event: EventDto; siteName?: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
          <Box flex={1}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Link to={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography fontWeight={700} component="span">
                  {event.name}
                </Typography>
              </Link>
              <Chip
                size="small"
                label={event.status}
                color={STATUS_COLORS[event.status]}
                variant="outlined"
              />
            </Stack>
            <Stack direction="row" gap={2} mt={0.5} color="text.secondary" flexWrap="wrap">
              <Typography variant="body2">{formatEventRange(event)}</Typography>
              {siteName && (
                <Stack direction="row" gap={0.5} alignItems="center">
                  <Place fontSize="inherit" />
                  <Typography variant="body2">{siteName}</Typography>
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyState({ hasUpcoming }: { hasUpcoming: boolean }) {
  return (
    <Card>
      <CardContent>
        <Stack alignItems="center" textAlign="center" spacing={1} py={3}>
          <CalendarMonth color="disabled" sx={{ fontSize: 48 }} />
          <Typography variant="h2">Sin eventos próximos</Typography>
          <Typography color="text.secondary">
            {hasUpcoming
              ? 'No hay eventos que coincidan con los filtros activos.'
              : 'Cuando crees un evento, aparecerá acá para que todo el equipo lo vea.'}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
