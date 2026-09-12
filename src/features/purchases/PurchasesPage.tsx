import { useMemo, useState } from 'react';
import {
  Add,
  ArrowForward,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  Search,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
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
import {
  useCreatePurchaseRequest,
  usePurchaseRequests,
  type CreatePurchaseRequestInput,
  type PurchaseRequestDto,
  type PurchaseStatus,
} from '../../integrations/data';
import { purchaseStatusColor, purchaseStatusLabel } from '../../domain/purchasing';
import { NewPurchaseDialog } from './NewPurchaseDialog';

const STATUS_FILTERS: { key: PurchaseStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Todas' },
  { key: 'DRAFT', label: 'Borrador' },
  { key: 'SUBMITTED', label: 'En evaluación' },
  { key: 'APPROVED', label: 'Aprobadas' },
  { key: 'COMPLETED', label: 'Completadas' },
  { key: 'REJECTED', label: 'Rechazadas' },
  { key: 'CANCELLED', label: 'Canceladas' },
];

function statusChip(status: PurchaseStatus) {
  const color = purchaseStatusColor(status);
  switch (color) {
    case 'success':
      return {
        color: 'success' as const,
        label: purchaseStatusLabel(status),
        icon: <CheckCircle fontSize="small" />,
      };
    case 'error':
      return {
        color: 'error' as const,
        label: purchaseStatusLabel(status),
        icon: <ErrorIcon fontSize="small" />,
      };
    case 'warning':
      return {
        color: 'warning' as const,
        label: purchaseStatusLabel(status),
        icon: <HourglassEmpty fontSize="small" />,
      };
    default:
      return { color: 'default' as const, label: purchaseStatusLabel(status), icon: null };
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function filterRequests(
  list: PurchaseRequestDto[] | undefined,
  search: string,
  status: PurchaseStatus | 'ALL',
): PurchaseRequestDto[] {
  if (!list) return [];
  return list.filter((r) => {
    if (status !== 'ALL' && r.status !== status) return false;
    if (search) {
      const haystack = `${r.title} ${r.description ?? ''}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}

export function PurchasesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PurchaseStatus | 'ALL'>('ALL');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, error } = usePurchaseRequests();
  const create = useCreatePurchaseRequest();

  const filtered = useMemo(() => filterRequests(data, search, status), [data, search, status]);

  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : 'No se pudo cargar la lista de compras.'
    : null;

  const onCreate = async (input: CreatePurchaseRequestInput) => {
    const result = await create.mutateAsync(input);
    setCreating(false);
    return result;
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Chip label="Ola 3b · Compras" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Compras
        </Typography>
        <Typography color="text.secondary">
          Necesidades, cotizaciones, scoring explicable y decisiones trazables.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por título o descripción…"
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
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreating(true)}>
              Nueva compra
            </Button>
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
          <Table size="small" aria-label="Compras">
            <TableHead>
              <TableRow>
                <TableCell>Estado</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Ítems</TableCell>
                <TableCell>Cotizaciones</TableCell>
                <TableCell>Estimado</TableCell>
                <TableCell>Creada</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, idx) => (
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
                      <Typography variant="h2">Sin solicitudes de compra</Typography>
                      <Typography color="text.secondary" mt={1}>
                        Crea una nueva necesidad para empezar a recibir cotizaciones.
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
                    <TableCell>
                      <Typography fontWeight={700}>{r.title}</Typography>
                      {r.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          maxWidth={320}
                          title={r.description}
                        >
                          {r.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{r.itemCount ?? 0}</TableCell>
                    <TableCell>{r.quoteCount ?? 0}</TableCell>
                    <TableCell>{formatCurrency(r.estimatedTotal)}</TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        component={Link}
                        to={`/purchases/${r.id}`}
                        aria-label={`Ver ${r.title}`}
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

      <NewPurchaseDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={onCreate}
        saving={create.isPending}
      />
    </Stack>
  );
}

export default PurchasesPage;
