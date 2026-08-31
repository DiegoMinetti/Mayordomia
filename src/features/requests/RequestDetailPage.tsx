import { useMemo, useState } from 'react';
import {
  ArrowBack,
  CheckCircle,
  Close,
  ErrorOutline,
  HourglassEmpty,
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
  Divider,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { useApproveRequest, useRejectRequest, useRequest } from '../../integrations/data';
import { rollupApprovals, type ApprovalRollup } from '../../domain/request';

const TYPE_LABELS: Record<string, string> = {
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  PENDING_AREA_APPROVAL: 'Esperando aprobación de área',
  PENDING_GENERAL_APPROVAL: 'Esperando aprobación general',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
};

function rollupChip(rollup: ApprovalRollup) {
  switch (rollup) {
    case 'APPROVED':
      return { color: 'success' as const, label: 'Aprobada' };
    case 'REJECTED':
      return { color: 'error' as const, label: 'Rechazada' };
    case 'PENDING':
      return { color: 'warning' as const, label: 'Pendiente' };
    default:
      return { color: 'default' as const, label: 'Sin datos' };
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

function isVersionMismatch(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string };
  return e.code === 'VERSION_MISMATCH' || /version|concurren/i.test(e.message ?? '');
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useRequest(id);
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const [comment, setComment] = useState('');
  const [versionError, setVersionError] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!data?.approvals) return null;
    return rollupApprovals(
      data.approvals.map((a) => ({
        ...a,
        organizationId: data.organizationId,
        requestId: a.requestId,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt ?? a.createdAt,
        createdBy: '',
        updatedBy: '',
        version: a.version,
      })),
    );
  }, [data]);

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width="40%" height={48} />
        <Skeleton variant="rectangular" height={180} />
        <Skeleton variant="rectangular" height={120} />
      </Stack>
    );
  }

  if (isError || !data) {
    const message = isError
      ? error instanceof Error
        ? error.message
        : 'No se pudo cargar la solicitud.'
      : 'Solicitud no encontrada.';
    return (
      <Stack spacing={2}>
        <Button
          component={Link}
          to="/requests"
          startIcon={<ArrowBack />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Volver a solicitudes
        </Button>
        <Alert severity="error">{message}</Alert>
      </Stack>
    );
  }

  const canApproveArea =
    data.needsAreaApproval === true && data.status !== 'REJECTED' && data.status !== 'CANCELLED';
  const canApproveGeneral =
    data.needsGeneralApproval === true && data.status !== 'REJECTED' && data.status !== 'CANCELLED';
  const canReject =
    data.status !== 'REJECTED' && data.status !== 'CANCELLED' && data.status !== 'DELIVERED';
  const isClosed = ['APPROVED', 'REJECTED', 'CANCELLED', 'DELIVERED'].includes(data.status);

  const onApprove = async (scope: 'AREA' | 'GENERAL') => {
    setVersionError(null);
    try {
      const result = await approve.mutateAsync({
        id: data.id,
        scope,
        expectedVersion: data.version,
        comment: comment || undefined,
      });
      if (result) await refetch();
    } catch (err) {
      if (isVersionMismatch(err)) {
        setVersionError('La solicitud fue modificada por otro usuario. Recargando…');
        await refetch();
      }
    }
  };

  const onReject = async (scope: 'AREA' | 'GENERAL') => {
    setVersionError(null);
    try {
      const result = await reject.mutateAsync({
        id: data.id,
        scope,
        expectedVersion: data.version,
        comment: comment || undefined,
      });
      if (result) await refetch();
    } catch (err) {
      if (isVersionMismatch(err)) {
        setVersionError('La solicitud fue modificada por otro usuario. Recargando…');
        await refetch();
      }
    }
  };

  return (
    <Stack spacing={3}>
      <Button
        component={Link}
        to="/requests"
        startIcon={<ArrowBack />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Volver a solicitudes
      </Button>
      {versionError && <Alert severity="warning">{versionError}</Alert>}

      <Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={STATUS_LABELS[data.status] ?? data.status}
            color={
              data.status === 'REJECTED'
                ? 'error'
                : data.status === 'APPROVED'
                  ? 'success'
                  : 'warning'
            }
            icon={
              data.status === 'REJECTED' ? (
                <ErrorOutline />
              ) : data.status === 'APPROVED' ? (
                <CheckCircle />
              ) : (
                <HourglassEmpty />
              )
            }
          />
          <Chip label={TYPE_LABELS[data.type] ?? data.type} variant="outlined" />
          {data.urgencyReason && (
            <Tooltip title={data.urgencyReason}>
              <Chip label="Urgente" color="warning" icon={<ReportProblem />} size="small" />
            </Tooltip>
          )}
        </Stack>
        <Typography variant="h1" mt={1}>
          {data.requesterName}
        </Typography>
        <Typography color="text.secondary">
          {data.requestedFor || data.description.slice(0, 80)}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h2">Detalles</Typography>
          <Stack mt={2} gap={1.5}>
            <DetailRow label="Email" value={data.requesterEmail || '—'} />
            <DetailRow label="Sede" value={data.siteId || '—'} />
            <DetailRow label="Origen" value={data.source} />
            <DetailRow label="Evento" value={formatDate(data.eventStart)} />
            {data.eventEnd && (
              <DetailRow label="Fin del evento" value={formatDate(data.eventEnd)} />
            )}
            <DetailRow label="Creada" value={formatDate(data.createdAt)} />
            <DetailRow label="Versión" value={String(data.version)} />
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2">Descripción</Typography>
            <Typography>{data.description}</Typography>
            {data.urgencyReason && (
              <>
                <Typography variant="subtitle2" mt={1}>
                  Motivo de urgencia
                </Typography>
                <Typography color="text.secondary">{data.urgencyReason}</Typography>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h2">Aprobaciones</Typography>
          {summary && (
            <Stack direction="row" gap={1} mt={2} flexWrap="wrap">
              <Chip
                label={`Área: ${rollupChip(summary.area).label}`}
                color={rollupChip(summary.area).color}
                size="small"
                variant={summary.area === 'PENDING' ? 'outlined' : 'filled'}
              />
              <Chip
                label={`General: ${rollupChip(summary.general).label}`}
                color={rollupChip(summary.general).color}
                size="small"
                variant={summary.general === 'PENDING' ? 'outlined' : 'filled'}
              />
            </Stack>
          )}
          <Stack mt={2} gap={1}>
            {(data.approvals ?? []).length === 0 && (
              <Typography color="text.secondary">Sin aprobaciones registradas.</Typography>
            )}
            {(data.approvals ?? []).map((a) => (
              <Box
                key={a.id}
                sx={{
                  p: 1.5,
                  border: '1px solid #eee',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Stack direction="row" gap={1} alignItems="center">
                  <Chip
                    size="small"
                    label={a.scope === 'AREA' ? 'Área' : 'General'}
                    color={a.scope === 'AREA' ? 'secondary' : 'primary'}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={a.status}
                    color={
                      a.status === 'APPROVED'
                        ? 'success'
                        : a.status === 'REJECTED'
                          ? 'error'
                          : 'warning'
                    }
                  />
                  {a.areaId && (
                    <Typography variant="body2" color="text.secondary">
                      Área: {a.areaId}
                    </Typography>
                  )}
                </Stack>
                {a.comment && <Typography variant="body2">“{a.comment}”</Typography>}
                {a.reviewedAt && (
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(a.reviewedAt)} · por {a.reviewedBy}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h2">Línea de tiempo</Typography>
          <Stack mt={2} gap={1.5}>
            {(data.timeline ?? []).length === 0 && (
              <Typography color="text.secondary">Sin eventos todavía.</Typography>
            )}
            {(data.timeline ?? []).map((ev, idx) => (
              <Stack key={`${ev.at}-${idx}`} direction="row" gap={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    mt: 0.5,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background:
                      ev.kind === 'APPROVED'
                        ? '#2e7d32'
                        : ev.kind === 'REJECTED'
                          ? '#c62828'
                          : ev.kind === 'CREATED'
                            ? '#214E46'
                            : '#999',
                  }}
                />
                <Box flex={1}>
                  <Typography fontWeight={600}>{ev.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(ev.at)} · {ev.actor || 'sistema'}
                  </Typography>
                  {ev.comment && (
                    <Typography variant="body2" mt={0.5}>
                      “{ev.comment}”
                    </Typography>
                  )}
                </Box>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h2">Decisión</Typography>
          {isClosed ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Esta solicitud ya está cerrada y no admite nuevas decisiones.
            </Alert>
          ) : (
            <Stack mt={2} gap={2}>
              <TextField
                label="Comentario (opcional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  color="success"
                  startIcon={approve.isPending ? <CircularProgress size={16} /> : <CheckCircle />}
                  disabled={!canApproveArea || approve.isPending || reject.isPending}
                  onClick={() => void onApprove('AREA')}
                >
                  Aprobar área
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={approve.isPending ? <CircularProgress size={16} /> : <CheckCircle />}
                  disabled={!canApproveGeneral || approve.isPending || reject.isPending}
                  onClick={() => void onApprove('GENERAL')}
                >
                  Aprobar general
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={reject.isPending ? <CircularProgress size={16} /> : <Close />}
                  disabled={!canReject || approve.isPending || reject.isPending}
                  onClick={() => void onReject(data.needsGeneralApproval ? 'GENERAL' : 'AREA')}
                >
                  Rechazar
                </Button>
                {approve.isError && (
                  <Typography color="error" variant="body2">
                    Error al aprobar.
                  </Typography>
                )}
                {reject.isError && (
                  <Typography color="error" variant="body2">
                    Error al rechazar.
                  </Typography>
                )}
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Typography>{value}</Typography>
    </Stack>
  );
}
