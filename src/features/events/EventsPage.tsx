import { useMemo, useState } from 'react';
import { CalendarToday, Event, Place } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  formatEventRange,
  groupByDay,
  type EventDto,
  type EventKind,
  type EventStatus,
} from '../../domain/event';
import { useEvents, useSites } from '../../integrations/data';

const KIND_LABELS: Record<EventKind, string> = {
  SERVICE: 'Servicio',
  REHEARSAL: 'Ensayo',
  CLASS: 'Clase',
  MEETING: 'Reunión',
  OTHER: 'Otro',
};

const STATUS_COLORS: Record<EventStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> =
  {
    DRAFT: 'default',
    PUBLISHED: 'success',
    CANCELLED: 'error',
    COMPLETED: 'primary',
  };

const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Completado',
};

function sortByStartAsc(a: EventDto, b: EventDto): number {
  return a.startAt.localeCompare(b.startAt);
}

export function EventsPage() {
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'ALL'>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');
  const [view, setView] = useState<'list' | 'agenda'>('list');
  const sites = useSites();
  const eventsQuery = useEvents(
    useMemo(
      () => ({
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(siteFilter !== 'ALL' ? { siteId: siteFilter } : {}),
      }),
      [statusFilter, siteFilter],
    ),
  );
  const events = useMemo(
    () => (eventsQuery.data ?? []).slice().sort(sortByStartAsc),
    [eventsQuery.data],
  );
  const ready = !eventsQuery.isLoading;
  return (
    <Stack spacing={3}>
      <Box>
        <Typography color="primary" fontWeight={700}>
          Eventos
        </Typography>
        <Typography variant="h1">Planificación operativa</Typography>
        <Typography color="text.secondary">
          Servicios, ensayos, clases y reuniones con sus áreas, recursos y personas asignadas.
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }}>
        <TextField
          select
          size="small"
          label="Estado"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EventStatus | 'ALL')}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">Todos</MenuItem>
          {(Object.keys(STATUS_LABELS) as EventStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Sede"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          sx={{ minWidth: 200 }}
          disabled={sites.isLoading}
        >
          <MenuItem value="ALL">Todas</MenuItem>
          {(sites.data ?? []).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <Box flex={1} />
        <ToggleButtonGroup
          size="small"
          value={view}
          exclusive
          onChange={(_, v) => v && setView(v)}
          aria-label="Modo de vista"
        >
          <ToggleButton value="list">Lista</ToggleButton>
          <ToggleButton value="agenda">Agenda</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {!ready ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress aria-label="Cargando eventos" />
        </Box>
      ) : events.length === 0 ? (
        <Alert severity="info">No hay eventos para los filtros seleccionados.</Alert>
      ) : view === 'list' ? (
        <Stack gap={1.5}>
          {events.map((event) => (
            <EventListItem
              key={event.id}
              event={event}
              siteName={lookupSite(sites.data, event.siteId)}
            />
          ))}
        </Stack>
      ) : (
        <Stack gap={2}>
          {groupByDay(events).map((bucket) => (
            <Box key={bucket.key}>
              <Typography variant="h2" mb={1}>
                {bucket.label}
              </Typography>
              <Stack gap={1.5}>
                {bucket.events.map((event) => (
                  <EventListItem
                    key={event.id}
                    event={event}
                    siteName={lookupSite(sites.data, event.siteId)}
                    compact
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function lookupSite(
  sites: { id: string; name: string }[] | undefined,
  siteId?: string,
): string | undefined {
  if (!sites || !siteId) return undefined;
  return sites.find((s) => s.id === siteId)?.name;
}

function EventListItem({
  event,
  siteName,
  compact = false,
}: {
  event: EventDto;
  siteName?: string;
  compact?: boolean;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea component={Link} to={`/events/${event.id}`}>
        <CardContent sx={{ py: compact ? 1.25 : 1.75 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
            <Box flex={1}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Typography fontWeight={700}>{event.name}</Typography>
                <Chip
                  size="small"
                  label={STATUS_LABELS[event.status]}
                  color={STATUS_COLORS[event.status]}
                />
                <Chip size="small" variant="outlined" label={KIND_LABELS[event.kind]} />
              </Stack>
              <Stack direction="row" gap={2} mt={0.5} color="text.secondary" flexWrap="wrap">
                <Stack direction="row" gap={0.5} alignItems="center">
                  <Event fontSize="inherit" />
                  <Typography variant="body2">{formatEventRange(event)}</Typography>
                </Stack>
                {siteName && (
                  <Stack direction="row" gap={0.5} alignItems="center">
                    <Place fontSize="inherit" />
                    <Typography variant="body2">{siteName}</Typography>
                  </Stack>
                )}
              </Stack>
            </Box>
            <Stack direction="row" gap={0.5} alignItems="center" color="text.secondary">
              <CalendarToday fontSize="inherit" />
              <Typography variant="body2">Ver detalle</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
