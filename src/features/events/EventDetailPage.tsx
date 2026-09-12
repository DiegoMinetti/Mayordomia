import { useParams } from 'react-router-dom';
import { ArrowBack, Event, Groups, Inventory2, Place, Schedule } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  formatEventRange,
  isOngoing,
  isPast,
  isUpcoming,
  type EventKind,
  type EventPeopleRole,
  type EventResponsibility,
  type EventStatus,
} from '../../domain/event';
import { useEvent, useSites } from '../../integrations/data';

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

const RESPONSIBILITY_LABELS: Record<EventResponsibility, string> = {
  LEAD: 'Lidera',
  SUPPORT: 'Apoya',
  INFO: 'Informado',
};

const PEOPLE_ROLE_LABELS: Record<EventPeopleRole, string> = {
  LEAD: 'Responsable',
  SUPPORT: 'Colabora',
  ATTENDEE: 'Asiste',
};

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const event = useEvent(id);
  const sites = useSites();
  if (event.isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress aria-label="Cargando evento" />
      </Box>
    );
  }
  if (event.isError || !event.data) {
    return (
      <Stack spacing={2}>
        <Button
          component={RouterLink}
          to="/events"
          startIcon={<ArrowBack />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Volver a eventos
        </Button>
        <Alert severity="error">No se encontró el evento solicitado.</Alert>
      </Stack>
    );
  }
  const e = event.data;
  const siteName = sites.data?.find((s) => s.id === e.siteId)?.name;
  const ongoing = isOngoing(e);
  const upcoming = isUpcoming(e);
  const past = isPast(e);
  const phaseLabel = ongoing
    ? 'En curso'
    : upcoming
      ? 'Próximo'
      : past
        ? 'Finalizado'
        : 'Sin fecha';
  return (
    <Stack spacing={3}>
      <Button
        component={RouterLink}
        to="/events"
        startIcon={<ArrowBack />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Volver a eventos
      </Button>
      <Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip size="small" label={KIND_LABELS[e.kind]} variant="outlined" />
          <Chip size="small" label={STATUS_LABELS[e.status]} color={STATUS_COLORS[e.status]} />
          <Chip
            size="small"
            label={phaseLabel}
            color={ongoing ? 'warning' : upcoming ? 'info' : past ? 'default' : 'default'}
            variant="outlined"
          />
        </Stack>
        <Typography variant="h1" mt={1}>
          {e.name}
        </Typography>
        {e.description && <Typography color="text.secondary">{e.description}</Typography>}
      </Box>
      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={3} flexWrap="wrap">
            <DetailField
              icon={<Event fontSize="small" />}
              label="Cuándo"
              value={formatEventRange(e)}
            />
            <DetailField
              icon={<Schedule fontSize="small" />}
              label="Duración"
              value={durationLabel(e.startAt, e.endAt, e.allDay)}
            />
            {siteName && (
              <DetailField icon={<Place fontSize="small" />} label="Sede" value={siteName} />
            )}
          </Stack>
        </CardContent>
      </Card>
      <Box>
        <Typography variant="h2" mb={1}>
          Áreas participantes
        </Typography>
        {e.areas.length === 0 ? (
          <Typography color="text.secondary">Este evento no tiene áreas asignadas.</Typography>
        ) : (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {e.areas.map((a) => (
              <Chip
                key={a.id}
                label={`${a.areaId} · ${RESPONSIBILITY_LABELS[a.responsibility]}`}
                color={a.responsibility === 'LEAD' ? 'primary' : 'default'}
                variant={a.responsibility === 'LEAD' ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        )}
      </Box>
      <Divider flexItem />
      <Box>
        <Stack direction="row" gap={1} alignItems="center" mb={1}>
          <Inventory2 fontSize="small" color="primary" />
          <Typography variant="h2">Recursos solicitados</Typography>
        </Stack>
        {e.resources.length === 0 ? (
          <Typography color="text.secondary">Sin recursos reservados.</Typography>
        ) : (
          <Table size="small" aria-label="Recursos del evento">
            <TableHead>
              <TableRow>
                <TableCell>Recurso</TableCell>
                <TableCell align="right">Cantidad</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {e.resources.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.resourceId}</TableCell>
                  <TableCell align="right">{r.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
      <Divider flexItem />
      <Box>
        <Stack direction="row" gap={1} alignItems="center" mb={1}>
          <Groups fontSize="small" color="primary" />
          <Typography variant="h2">Personas</Typography>
        </Stack>
        {e.people.length === 0 ? (
          <Typography color="text.secondary">Aún no hay personas asignadas.</Typography>
        ) : (
          <Stack gap={1}>
            {e.people.map((p) => (
              <Stack key={p.id} direction="row" gap={1} alignItems="center">
                <Chip
                  size="small"
                  label={PEOPLE_ROLE_LABELS[p.role]}
                  color={p.role === 'LEAD' ? 'primary' : 'default'}
                  variant={p.role === 'LEAD' ? 'filled' : 'outlined'}
                />
                <Typography variant="body2">{p.personId}</Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
      {e.template && (
        <>
          <Divider flexItem />
          <Box>
            <Typography variant="h2" mb={0.5}>
              Basado en plantilla
            </Typography>
            <Typography color="text.secondary">{e.template.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Duración sugerida: {e.template.durationMinutes} min
            </Typography>
          </Box>
        </>
      )}
    </Stack>
  );
}

function DetailField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack direction="row" gap={1} alignItems="center">
      {icon}
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography fontWeight={600}>{value}</Typography>
      </Box>
    </Stack>
  );
}

function durationLabel(startAt: string, endAt: string, allDay: boolean): string {
  if (allDay) return 'Día completo';
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const minutes = Math.max(0, Math.round((end - start) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} h` : `${hours} h ${rem} min`;
}
