import { useState } from 'react';
import {
  ArrowBack,
  CheckCircle,
  Edit,
  HourglassEmpty,
  NoteAdd,
  ReportProblem,
} from '@mui/icons-material';
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
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import {
  useMaintenance,
  useUpdateMaintenance,
  type UpdateMaintenancePayload,
  type MaintenanceUpdateDto,
  type MaintenanceStatusDto,
} from '../../integrations/data';
import {
  maintenanceKindLabel,
  maintenanceSeverityColor,
  maintenanceSeverityLabel,
  maintenanceStatusColor,
  maintenanceStatusLabel,
} from '../../domain/operations';

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

function updateIcon(kind: string) {
  switch (kind) {
    case 'STATUS':
      return <HourglassEmpty fontSize="small" />;
    case 'COST':
      return <Edit fontSize="small" />;
    case 'RESOLUTION':
      return <CheckCircle fontSize="small" />;
    default:
      return <NoteAdd fontSize="small" />;
  }
}

function UpdateTimelineItem({ update }: { update: MaintenanceUpdateDto }) {
  return (
    <Stack direction="row" gap={1.5} alignItems="flex-start">
      <Box mt={0.5}>{updateIcon(update.kind)}</Box>
      <Box flex={1}>
        <Typography fontWeight={600}>{update.text}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatDate(update.at)} · por {update.authorId}
        </Typography>
      </Box>
    </Stack>
  );
}

type ActionKind = 'START' | 'RESOLVE' | 'CANCEL' | 'NOTE';

function ActionDialog({
  open,
  kind,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  kind: ActionKind;
  onClose: () => void;
  onSubmit: (
    payload: Omit<UpdateMaintenancePayload, 'id' | 'expectedVersion' | 'actorId'>,
  ) => Promise<void>;
  isPending: boolean;
}) {
  const [text, setText] = useState('');
  const [cost, setCost] = useState('');

  const handleClose = () => {
    if (isPending) return;
    setText('');
    setCost('');
    onClose();
  };

  const submit = async () => {
    let status: MaintenanceStatusDto | undefined;
    let resolution: string | undefined;
    let note: string | undefined;
    let costValue: number | undefined;
    if (kind === 'START') status = 'IN_PROGRESS';
    if (kind === 'CANCEL') status = 'CANCELLED';
    if (kind === 'RESOLVE') {
      status = 'RESOLVED';
      resolution = text.trim() || undefined;
    }
    if (kind === 'NOTE') note = text.trim() || undefined;
    if (cost.trim()) {
      const parsed = Number(cost);
      if (Number.isFinite(parsed) && parsed >= 0) costValue = parsed;
    }
    await onSubmit({
      status,
      resolution,
      note,
      cost: costValue,
    });
    setText('');
    setCost('');
  };

  const titles: Record<ActionKind, string> = {
    START: 'Iniciar trabajo',
    RESOLVE: 'Resolver mantenimiento',
    CANCEL: 'Cancelar mantenimiento',
    NOTE: 'Agregar nota',
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{titles[kind]}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {kind === 'RESOLVE' ? (
            <TextField
              label="Resolución"
              multiline
              minRows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              fullWidth
            />
          ) : kind === 'NOTE' ? (
            <TextField
              label="Nota"
              multiline
              minRows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              fullWidth
            />
          ) : (
            <Alert severity="info">
              {kind === 'START'
                ? 'Vas a marcar este mantenimiento como En curso.'
                : 'Vas a cancelar este mantenimiento.'}
            </Alert>
          )}
          <TextField
            label="Costo (opcional)"
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            sx={{ maxWidth: 240 }}
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
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <CheckCircle />}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useMaintenance(id);
  const update = useUpdateMaintenance();
  const [action, setAction] = useState<ActionKind | null>(null);

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width="40%" height={48} />
        <Skeleton variant="rectangular" height={180} />
        <Skeleton variant="rectangular" height={220} />
      </Stack>
    );
  }

  if (isError || !data) {
    return (
      <Stack spacing={2}>
        <Button
          component={Link}
          to="/maintenance"
          startIcon={<ArrowBack />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Volver a mantenimiento
        </Button>
        <Alert severity="error">
          {isError
            ? error instanceof Error
              ? error.message
              : 'No se pudo cargar el mantenimiento.'
            : 'Mantenimiento no encontrado.'}
        </Alert>
      </Stack>
    );
  }

  const { maintenance, updates, resource } = data;
  const isClosed = maintenance.status === 'RESOLVED' || maintenance.status === 'CANCELLED';

  const onSubmit = async (
    payload: Omit<UpdateMaintenancePayload, 'id' | 'expectedVersion' | 'actorId'>,
  ) => {
    try {
      await update.mutateAsync({
        id: maintenance.id,
        expectedVersion: maintenance.version,
        actorId: 'u-operador',
        ...payload,
      });
      setAction(null);
      await refetch();
    } catch {
      // surfaced below; nothing else to do here
    }
  };

  return (
    <Stack spacing={3}>
      <Button
        component={Link}
        to="/maintenance"
        startIcon={<ArrowBack />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Volver a mantenimiento
      </Button>

      <Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={maintenanceStatusLabel(maintenance.status)}
            color={maintenanceStatusColor(maintenance.status)}
            icon={
              maintenance.status === 'RESOLVED' ? (
                <CheckCircle />
              ) : maintenance.status === 'IN_PROGRESS' ? (
                <HourglassEmpty />
              ) : maintenance.status === 'CANCELLED' ? (
                <ReportProblem />
              ) : (
                <ReportProblem />
              )
            }
          />
          <Chip
            label={`Severidad: ${maintenanceSeverityLabel(maintenance.severity)}`}
            color={maintenanceSeverityColor(maintenance.severity)}
            variant="outlined"
          />
          <Chip label={maintenanceKindLabel(maintenance.kind)} variant="outlined" />
        </Stack>
        <Typography variant="h1" mt={1}>
          {maintenance.description}
        </Typography>
        <Typography color="text.secondary">
          Reportado el {formatDate(maintenance.reportedAt)} por {maintenance.reportedBy}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h2">Detalles</Typography>
          <Stack mt={2} gap={1}>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                Recurso afectado
              </Typography>
              <Typography>
                {resource
                  ? `${resource.name} (${resource.status})`
                  : (maintenance.resourceId ?? '—')}
              </Typography>
            </Stack>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                Inicio
              </Typography>
              <Typography>{formatDate(maintenance.startedAt)}</Typography>
            </Stack>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                Resolución
              </Typography>
              <Typography>{formatDate(maintenance.resolvedAt)}</Typography>
            </Stack>
            {typeof maintenance.cost === 'number' ? (
              <Stack direction="row" gap={1} alignItems="center">
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                  Costo
                </Typography>
                <Typography>{maintenance.cost.toLocaleString('es-AR')}</Typography>
              </Stack>
            ) : null}
            {maintenance.resolution ? (
              <>
                <Typography variant="subtitle2" mt={1}>
                  Resolución registrada
                </Typography>
                <Typography>{maintenance.resolution}</Typography>
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h2">Línea de tiempo</Typography>
            {!isClosed ? (
              <Stack direction="row" gap={1}>
                {maintenance.status === 'OPEN' ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<HourglassEmpty />}
                    onClick={() => setAction('START')}
                  >
                    Iniciar
                  </Button>
                ) : null}
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CheckCircle />}
                  onClick={() => setAction('RESOLVE')}
                >
                  Resolver
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<NoteAdd />}
                  onClick={() => setAction('NOTE')}
                >
                  Agregar nota
                </Button>
                {maintenance.status !== 'CANCELLED' ? (
                  <Button size="small" color="error" onClick={() => setAction('CANCEL')}>
                    Cancelar
                  </Button>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
          {updates.length === 0 ? (
            <Typography color="text.secondary">Sin actualizaciones todavía.</Typography>
          ) : (
            <Stack gap={1.5}>
              {updates.map((u) => (
                <UpdateTimelineItem key={u.id} update={u} />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {action ? (
        <ActionDialog
          open={Boolean(action)}
          kind={action}
          onClose={() => setAction(null)}
          onSubmit={onSubmit}
          isPending={update.isPending}
        />
      ) : null}

      {update.isError ? (
        <Alert severity="error">No se pudo actualizar el mantenimiento.</Alert>
      ) : null}
    </Stack>
  );
}
