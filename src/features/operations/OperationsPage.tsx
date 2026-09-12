import { useMemo, useState } from 'react';
import { ArrowForward, HandymanOutlined, LocalShipping, Refresh } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  useDeliveries,
  useRequests,
  type DeliveryDto,
  type DeliveryListFilters,
  type DeliveryStatusDto,
} from '../../integrations/data';
import { deliveryStatusColor, deliveryStatusLabel } from '../../domain/operations';

const STATUS_FILTERS: { label: string; value: DeliveryStatusDto | 'ALL' }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'En curso', value: 'IN_PROGRESS' },
  { label: 'Completadas', value: 'COMPLETED' },
  { label: 'Borrador', value: 'DRAFT' },
  { label: 'Canceladas', value: 'CANCELLED' },
];

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

function DeliveryRow({ delivery }: { delivery: DeliveryDto }) {
  return (
    <Button
      component={Link}
      to={`/operations/${delivery.id}`}
      color="inherit"
      sx={{
        justifyContent: 'space-between',
        py: 1.5,
        px: 1.5,
        borderRadius: 2,
        textAlign: 'left',
        alignItems: 'center',
        borderTop: '1px solid #eee',
      }}
      endIcon={<ArrowForward />}
    >
      <Box flex={1}>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={deliveryStatusLabel(delivery.status)}
            color={deliveryStatusColor(delivery.status)}
            size="small"
          />
          <Typography fontWeight={700}>{delivery.recipientName}</Typography>
          <Typography variant="body2" color="text.secondary">
            Solicitud: {delivery.requestId}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Entregado {formatDate(delivery.deliveredAt)} · por {delivery.deliveredBy}
        </Typography>
        {delivery.notes ? (
          <Typography variant="body2" color="text.secondary" mt={0.25}>
            “{delivery.notes}”
          </Typography>
        ) : null}
      </Box>
    </Button>
  );
}

export function OperationsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusDto | 'ALL'>('ALL');
  const [requestFilter, setRequestFilter] = useState<string>('');

  const filters: DeliveryListFilters = useMemo(() => {
    const f: DeliveryListFilters = {};
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (requestFilter.trim()) f.requestId = requestFilter.trim();
    return f;
  }, [statusFilter, requestFilter]);

  const deliveries = useDeliveries(filters);
  const approvedRequests = useRequests({ status: 'APPROVED' });

  const visible = useMemo(() => {
    const list = deliveries.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (d) =>
        d.recipientName.toLowerCase().includes(q) ||
        d.requestId.toLowerCase().includes(q) ||
        (d.notes ?? '').toLowerCase().includes(q),
    );
  }, [deliveries.data, search]);

  return (
    <Stack spacing={3}>
      <Box>
        <Chip label="PR 3a · Operación" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Operación
        </Typography>
        <Typography color="text.secondary">
          Entregas y devoluciones de recursos y espacios. Las devoluciones con daños generan un
          registro de mantenimiento automáticamente.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por destinatario, solicitud o nota…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <TextField
          select
          size="small"
          label="Estado"
          SelectProps={{ native: true }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DeliveryStatusDto | 'ALL')}
          sx={{ minWidth: 200 }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </TextField>
        <TextField
          size="small"
          label="ID solicitud"
          value={requestFilter}
          onChange={(e) => setRequestFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Stack>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h2">Entregas</Typography>
              <Typography variant="body2" color="text.secondary">
                {deliveries.data ? `${visible.length} entregas` : 'Cargando…'}
              </Typography>
            </Box>
            <Stack direction="row" gap={1} alignItems="center">
              <Chip
                icon={<LocalShipping />}
                label="Entrega"
                color="primary"
                size="small"
                variant="outlined"
              />
              <Chip icon={<Refresh />} label="Devolución" size="small" variant="outlined" />
            </Stack>
          </Stack>
          {deliveries.error ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No se pudo cargar la lista de entregas.
            </Alert>
          ) : null}
          {deliveries.isLoading ? (
            <Stack mt={2} gap={1}>
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
            </Stack>
          ) : visible.length === 0 ? (
            <Typography color="text.secondary" mt={2}>
              {approvedRequests.data && approvedRequests.data.length > 0
                ? 'No hay entregas registradas. Usá la sección de abajo para iniciar una entrega desde una solicitud aprobada.'
                : 'No hay entregas registradas.'}
            </Typography>
          ) : (
            <Stack mt={2} gap={0.5}>
              {visible.map((d) => (
                <DeliveryRow key={d.id} delivery={d} />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h2">Solicitudes aprobadas listas para entregar</Typography>
              <Typography variant="body2" color="text.secondary">
                Iniciá una entrega tomando como base una solicitud aprobada.
              </Typography>
            </Box>
            <Chip
              icon={<HandymanOutlined />}
              label={`${approvedRequests.data?.length ?? 0}`}
              color="primary"
              size="small"
            />
          </Stack>
          {approvedRequests.isLoading ? (
            <Stack mt={2} gap={1}>
              <Skeleton variant="rounded" height={48} />
              <Skeleton variant="rounded" height={48} />
            </Stack>
          ) : (approvedRequests.data ?? []).length === 0 ? (
            <Typography color="text.secondary" mt={2}>
              No hay solicitudes aprobadas pendientes de entrega.
            </Typography>
          ) : (
            <Stack mt={2} gap={1}>
              {(approvedRequests.data ?? []).map((req) => (
                <Stack
                  key={req.id}
                  direction="row"
                  gap={1}
                  alignItems="center"
                  sx={{ py: 1, borderTop: '1px solid #eee' }}
                >
                  <Box flex={1}>
                    <Typography fontWeight={600}>{req.requesterName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {req.description.slice(0, 80)}
                      {req.description.length > 80 ? '…' : ''}
                    </Typography>
                  </Box>
                  <Chip label={req.type} size="small" variant="outlined" />
                  <Button
                    component={Link}
                    to={`/operations/new?requestId=${encodeURIComponent(req.id)}`}
                    variant="outlined"
                    size="small"
                  >
                    Crear entrega
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {deliveries.isFetching && !deliveries.isLoading ? (
        <Stack direction="row" gap={1} alignItems="center" color="text.secondary">
          <CircularProgress size={14} />
          <Typography variant="body2">Actualizando…</Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
