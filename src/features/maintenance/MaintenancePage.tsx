import { useMemo, useState } from 'react';
import { Add, ArrowForward, HandymanOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  useCreateMaintenance,
  useMaintenanceList,
  useResources,
  type CreateMaintenancePayload,
  type MaintenanceDto,
  type MaintenanceListFilters,
  type MaintenanceSeverityDto,
  type MaintenanceStatusDto,
  type MaintenanceKindDto,
} from '../../integrations/data';
import {
  maintenanceKindLabel,
  maintenanceSeverityColor,
  maintenanceSeverityLabel,
  maintenanceStatusColor,
  maintenanceStatusLabel,
} from '../../domain/operations';

const STATUS_FILTERS: { label: string; value: MaintenanceStatusDto | 'ALL' }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Abiertas', value: 'OPEN' },
  { label: 'En curso', value: 'IN_PROGRESS' },
  { label: 'Resueltas', value: 'RESOLVED' },
  { label: 'Canceladas', value: 'CANCELLED' },
];

const SEVERITY_FILTERS: { label: string; value: MaintenanceSeverityDto | 'ALL' }[] = [
  { label: 'Toda severidad', value: 'ALL' },
  { label: 'Baja', value: 'LOW' },
  { label: 'Media', value: 'MEDIUM' },
  { label: 'Alta', value: 'HIGH' },
  { label: 'Crítica', value: 'CRITICAL' },
];

const KINDS: MaintenanceKindDto[] = ['CORRECTIVE', 'PREVENTIVE', 'INSPECTION'];
const SEVERITIES: MaintenanceSeverityDto[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

function MaintenanceRow({ record }: { record: MaintenanceDto }) {
  return (
    <Button
      component={Link}
      to={`/maintenance/${record.id}`}
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
            size="small"
            label={maintenanceStatusLabel(record.status)}
            color={maintenanceStatusColor(record.status)}
          />
          <Chip
            size="small"
            label={`Severidad: ${maintenanceSeverityLabel(record.severity)}`}
            color={maintenanceSeverityColor(record.severity)}
            variant="outlined"
          />
          <Chip size="small" label={maintenanceKindLabel(record.kind)} variant="outlined" />
        </Stack>
        <Typography fontWeight={700} mt={0.5}>
          {record.description}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Reportado el {formatDate(record.reportedAt)} por {record.reportedBy}
          {record.resolvedAt ? ` · Resuelto el ${formatDate(record.resolvedAt)}` : ''}
        </Typography>
      </Box>
    </Button>
  );
}

interface ReportIssueDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<CreateMaintenancePayload, 'reportedBy'>) => Promise<void>;
  isPending: boolean;
}

function ReportIssueDialog({ open, onClose, onSubmit, isPending }: ReportIssueDialogProps) {
  const resources = useResources();
  const [kind, setKind] = useState<MaintenanceKindDto>('CORRECTIVE');
  const [severity, setSeverity] = useState<MaintenanceSeverityDto>('MEDIUM');
  const [description, setDescription] = useState('');
  const [resourceId, setResourceId] = useState<string>('');

  const reset = () => {
    setKind('CORRECTIVE');
    setSeverity('MEDIUM');
    setDescription('');
    setResourceId('');
  };

  const handleClose = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!description.trim()) return;
    await onSubmit({
      kind,
      severity,
      description: description.trim(),
      resourceId: resourceId || undefined,
    });
    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reportar falla</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            select
            fullWidth
            label="Tipo"
            value={kind}
            onChange={(e) => setKind(e.target.value as MaintenanceKindDto)}
          >
            {KINDS.map((k) => (
              <MenuItem key={k} value={k}>
                {maintenanceKindLabel(k)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Severidad"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as MaintenanceSeverityDto)}
          >
            {SEVERITIES.map((s) => (
              <MenuItem key={s} value={s}>
                {maintenanceSeverityLabel(s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Recurso afectado (opcional)"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          >
            <MenuItem value="">— Ninguno —</MenuItem>
            {(resources.data ?? []).map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={3}
            required
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={isPending || !description.trim()}
          startIcon={isPending ? <CircularProgress size={16} /> : <Add />}
        >
          Crear reporte
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MaintenancePage() {
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatusDto | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<MaintenanceSeverityDto | 'ALL'>('ALL');
  const [reportOpen, setReportOpen] = useState(false);

  const filters: MaintenanceListFilters = useMemo(() => {
    const f: MaintenanceListFilters = {};
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (severityFilter !== 'ALL') f.severity = severityFilter;
    return f;
  }, [statusFilter, severityFilter]);

  const maintenance = useMaintenanceList(filters);
  const create = useCreateMaintenance();

  const onCreate = async (payload: Omit<CreateMaintenancePayload, 'reportedBy'>) => {
    await create.mutateAsync({ ...payload, reportedBy: 'u-operador' });
    setReportOpen(false);
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Chip label="PR 3a · Mantenimiento" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Mantenimiento
        </Typography>
        <Typography color="text.secondary">
          Correctivo, preventivo e inspecciones. Los items devueltos con daños generan un registro
          aquí automáticamente.
        </Typography>
      </Box>

      <Stack direction="row" gap={1} justifyContent="space-between" alignItems="center">
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <TextField
            select
            size="small"
            label="Estado"
            SelectProps={{ native: true }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MaintenanceStatusDto | 'ALL')}
            sx={{ minWidth: 180 }}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Severidad"
            SelectProps={{ native: true }}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as MaintenanceSeverityDto | 'ALL')}
            sx={{ minWidth: 180 }}
          >
            {SEVERITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </TextField>
        </Stack>
        <Button variant="contained" startIcon={<Add />} onClick={() => setReportOpen(true)}>
          Reportar falla
        </Button>
      </Stack>

      {maintenance.error ? (
        <Alert severity="warning">No se pudo cargar la lista de mantenimientos.</Alert>
      ) : null}

      <Card>
        <CardContent>
          <Stack direction="row" gap={1} alignItems="center" mb={2}>
            <HandymanOutlined color="primary" />
            <Typography variant="h2">Reportes</Typography>
            <Chip label={maintenance.data?.length ?? 0} size="small" />
          </Stack>
          {maintenance.isLoading ? (
            <Stack gap={1}>
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
            </Stack>
          ) : (maintenance.data ?? []).length === 0 ? (
            <Typography color="text.secondary">
              Sin reportes. Probá cambiar los filtros o reportar una nueva falla.
            </Typography>
          ) : (
            <Stack gap={0.5}>
              {(maintenance.data ?? []).map((m) => (
                <MaintenanceRow key={m.id} record={m} />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <ReportIssueDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={onCreate}
        isPending={create.isPending}
      />
    </Stack>
  );
}
