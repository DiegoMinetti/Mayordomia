import { useMemo, useState } from 'react';
import {
  ArrowForward,
  CheckCircle,
  Error as ErrorIcon,
  FilterList,
  HourglassEmpty,
  Search,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useRequests } from '../../integrations/data';
import type {
  RequestDto,
  RequestListFilters,
  RequestStatus,
  RequestType,
} from '../../integrations/data';

const STATUS_FILTERS: { key: RequestStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Todas' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'PENDING_AREA_APPROVAL', label: 'Aprob. área' },
  { key: 'PENDING_GENERAL_APPROVAL', label: 'Aprob. general' },
  { key: 'APPROVED', label: 'Aprobadas' },
  { key: 'REJECTED', label: 'Rechazadas' },
  { key: 'DELIVERED', label: 'Entregadas' },
  { key: 'CANCELLED', label: 'Canceladas' },
];

const TYPE_LABELS: Record<RequestType, string> = {
  RESOURCE: 'Recursos',
  LOCATION: 'Espacio',
  AUDIO: 'Sonido',
  MULTIMEDIA: 'Multimedia',
  LIGHTING: 'Iluminación',
  SUPPORT: 'Apoyo',
  MAINTENANCE: 'Mantenimiento',
  PURCHASE: 'Compra',
  OTHER: 'Otro',
};

function statusChip(status: RequestStatus) {
  switch (status) {
    case 'PENDING':
    case 'PENDING_AREA_APPROVAL':
    case 'PENDING_GENERAL_APPROVAL':
      return {
        color: 'warning' as const,
        label: 'Pendiente',
        icon: <HourglassEmpty fontSize="small" />,
      };
    case 'APPROVED':
      return {
        color: 'success' as const,
        label: 'Aprobada',
        icon: <CheckCircle fontSize="small" />,
      };
    case 'REJECTED':
      return { color: 'error' as const, label: 'Rechazada', icon: <ErrorIcon fontSize="small" /> };
    case 'DELIVERED':
      return {
        color: 'primary' as const,
        label: 'Entregada',
        icon: <CheckCircle fontSize="small" />,
      };
    case 'CANCELLED':
      return { color: 'default' as const, label: 'Cancelada', icon: null };
    case 'DRAFT':
      return { color: 'default' as const, label: 'Borrador', icon: null };
    default:
      return { color: 'default' as const, label: status, icon: null };
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function filterRequests(
  list: RequestDto[] | undefined,
  search: string,
  status: RequestStatus | 'ALL',
  type: RequestType | 'ALL',
): RequestDto[] {
  if (!list) return [];
  return list.filter((r) => {
    if (status !== 'ALL' && r.status !== status) return false;
    if (type !== 'ALL' && r.type !== type) return false;
    if (search) {
      const haystack = `${r.requesterName} ${r.description} ${r.requestedFor ?? ''}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}

export function RequestsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [type, setType] = useState<RequestType | 'ALL'>('ALL');
  const serverFilters = useMemo<RequestListFilters>(() => ({}), []);
  const { data, isLoading, isError, error } = useRequests(serverFilters);

  const filtered = useMemo(
    () => filterRequests(data, search, status, type),
    [data, search, status, type],
  );

  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : 'No se pudieron cargar las solicitudes.'
    : null;

  return (
    <Stack spacing={3}>
      <Box>
        <Chip label="Operación" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Solicitudes
        </Typography>
        <Typography color="text.secondary">
          Revisá, aprobá y acompañá cada pedido hasta su entrega.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por nombre, motivo o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              size="small"
              label="Tipo"
              value={type}
              onChange={(e) => setType(e.target.value as RequestType | 'ALL')}
              slotProps={{ select: { native: true } }}
              sx={{ minWidth: 160 }}
            >
              <option value="ALL">Todos</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </TextField>
            <IconButton aria-label="Filtros avanzados" size="small" disabled>
              <FilterList />
            </IconButton>
          </Stack>
          <Stack direction="row" gap={1} mt={2} flexWrap="wrap">
            {STATUS_FILTERS.map((s) => (
              <Chip
                key={s.key}
                label={s.label}
                color={status === s.key ? 'primary' : 'default'}
                variant={status === s.key ? 'filled' : 'outlined'}
                onClick={() => setStatus(s.key)}
                size="small"
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Card>
        <TableContainer>
          <Table size="small" aria-label="Solicitudes">
            <TableHead>
              <TableRow>
                <TableCell>Estado</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Solicitante</TableCell>
                <TableCell>Motivo</TableCell>
                <TableCell>Evento</TableCell>
                <TableCell>Creada</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell colSpan={7}>
                      <Skeleton variant="text" height={32} />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box textAlign="center" py={6}>
                      <Typography variant="h2">Sin solicitudes</Typography>
                      <Typography color="text.secondary" mt={1}>
                        Cuando lleguen nuevas solicitudes las vas a ver acá.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const chip = statusChip(r.status);
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Chip
                        label={chip.label}
                        color={chip.color}
                        size="small"
                        icon={chip.icon ?? undefined}
                        variant={chip.color === 'default' ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell>{TYPE_LABELS[r.type] ?? r.type}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{r.requesterName}</Typography>
                      {r.requesterEmail && (
                        <Typography variant="body2" color="text.secondary">
                          {r.requesterEmail}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography noWrap maxWidth={260} title={r.description}>
                        {r.description}
                      </Typography>
                      {r.requestedFor && (
                        <Typography variant="body2" color="text.secondary">
                          {r.requestedFor}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{r.eventStart ? formatDate(r.eventStart) : '—'}</TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        component={Link}
                        to={`/requests/${r.id}`}
                        aria-label={`Ver ${r.requesterName}`}
                        size="small"
                      >
                        <ArrowForward />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  );
}
