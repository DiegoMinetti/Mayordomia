import { useState } from 'react';
import {
  ArrowBack,
  AssignmentReturn,
  CheckCircle,
  ErrorOutline,
  HourglassEmpty,
  Warning,
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
  Divider,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import {
  useDelivery,
  useReturnDeliveryItem,
  type ReturnDeliveryItemPayload,
  type DeliveryItemDto,
} from '../../integrations/data';
import {
  deliveryProgress,
  deliveryStatusColor,
  deliveryStatusLabel,
  returnConditionLabel,
  type ReturnCondition,
} from '../../domain/operations';

const CONDITIONS: {
  value: ReturnCondition;
  label: string;
  severity: 'success' | 'warning' | 'error';
}[] = [
  { value: 'OK', label: 'En buen estado', severity: 'success' },
  { value: 'DAMAGED', label: 'Dañado (genera mantenimiento)', severity: 'warning' },
  { value: 'LOST', label: 'Faltante', severity: 'error' },
];

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

interface ReturnDialogProps {
  item: DeliveryItemDto;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    payload: Omit<ReturnDeliveryItemPayload, 'deliveryItemId' | 'expectedVersion'>,
  ) => void;
  isPending: boolean;
}

function ReturnDialog({ item, open, onClose, onSubmit, isPending }: ReturnDialogProps) {
  const [condition, setCondition] = useState<ReturnCondition>('OK');
  const [notes, setNotes] = useState('');
  const [returnedQuantity, setReturnedQuantity] = useState<string>(String(item.quantity));

  const submit = () => {
    const qty = Number(returnedQuantity);
    onSubmit({
      condition,
      returnedBy: 'u-operador', // Mocked — would come from auth context in real use.
      notes: notes.trim() || undefined,
      returnedQuantity: Number.isFinite(qty) && qty > 0 ? qty : item.quantity,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Devolver item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            select
            fullWidth
            label="Condición"
            value={condition}
            onChange={(e) => setCondition(e.target.value as ReturnCondition)}
          >
            {CONDITIONS.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Cantidad devuelta"
            type="number"
            inputProps={{ min: 0, max: item.quantity }}
            value={returnedQuantity}
            onChange={(e) => setReturnedQuantity(e.target.value)}
          />
          <TextField
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
          />
          {condition === 'DAMAGED' ? (
            <Alert severity="warning" icon={<Warning />}>
              Esto va a generar un registro de mantenimiento automáticamente (severidad Media) y el
              recurso va a quedar marcado como <strong>Roto</strong>.
            </Alert>
          ) : condition === 'LOST' ? (
            <Alert severity="error">
              El recurso va a quedar marcado como <strong>Faltante</strong>. Esta acción no se puede
              deshacer automáticamente.
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <CheckCircle />}
        >
          Confirmar devolución
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useDelivery(id);
  const returnMutation = useReturnDeliveryItem();
  const [returning, setReturning] = useState<DeliveryItemDto | null>(null);

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
          to="/operations"
          startIcon={<ArrowBack />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Volver a operación
        </Button>
        <Alert severity="error">
          {isError
            ? error instanceof Error
              ? error.message
              : 'No se pudo cargar la entrega.'
            : 'Entrega no encontrada.'}
        </Alert>
      </Stack>
    );
  }

  const { delivery, items, progress, request, resources } = data;
  const isCompleted = delivery.status === 'COMPLETED';

  const onConfirmReturn = async (
    input: Omit<ReturnDeliveryItemPayload, 'deliveryItemId' | 'expectedVersion'>,
  ) => {
    if (!returning) return;
    const item = items.find((i) => i.id === returning.id);
    if (!item) return;
    try {
      await returnMutation.mutateAsync({
        deliveryItemId: item.id,
        expectedVersion: item.version,
        ...input,
      });
      setReturning(null);
      await refetch();
    } catch {
      // surfaced below; no further action
    }
  };

  return (
    <Stack spacing={3}>
      <Button
        component={Link}
        to="/operations"
        startIcon={<ArrowBack />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Volver a operación
      </Button>

      <Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={deliveryStatusLabel(delivery.status)}
            color={deliveryStatusColor(delivery.status)}
            icon={
              delivery.status === 'COMPLETED' ? (
                <CheckCircle />
              ) : delivery.status === 'IN_PROGRESS' ? (
                <HourglassEmpty />
              ) : (
                <ErrorOutline />
              )
            }
          />
          <Chip label={`Solicitud: ${delivery.requestId}`} variant="outlined" size="small" />
        </Stack>
        <Typography variant="h1" mt={1}>
          {delivery.recipientName}
        </Typography>
        <Typography color="text.secondary">
          Entregado {formatDate(delivery.deliveredAt)} · por {delivery.deliveredBy}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h2">Items</Typography>
              <Stack mt={2} gap={1.5}>
                {items.length === 0 ? (
                  <Typography color="text.secondary">Sin items cargados.</Typography>
                ) : (
                  items.map((item) => {
                    const resource = resources?.[item.resourceId];
                    const returned = Boolean(item.returnedAt);
                    return (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.5,
                          border: '1px solid #eee',
                          borderRadius: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5,
                        }}
                      >
                        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                          <Box flex={1}>
                            <Typography fontWeight={700}>
                              {resource?.name ?? `Recurso ${item.resourceId}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.quantity} unidad{item.quantity === 1 ? '' : 'es'}
                              {returned
                                ? ` · devuelto el ${formatDate(item.returnedAt)}`
                                : ' · sin devolver'}
                            </Typography>
                          </Box>
                          {returned && item.condition ? (
                            <Chip
                              label={returnConditionLabel(item.condition)}
                              color={
                                item.condition === 'OK'
                                  ? 'success'
                                  : item.condition === 'DAMAGED'
                                    ? 'warning'
                                    : 'error'
                              }
                              size="small"
                            />
                          ) : (
                            <Tooltip title="Devolver item">
                              <span>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AssignmentReturn />}
                                  onClick={() => setReturning(item)}
                                  disabled={isCompleted}
                                >
                                  Devolver
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                        {item.returnNotes ? (
                          <Typography variant="body2" color="text.secondary">
                            “{item.returnNotes}”
                          </Typography>
                        ) : null}
                      </Box>
                    );
                  })
                )}
              </Stack>
              {returnMutation.isError ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                  No se pudo registrar la devolución.
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h2">Progreso</Typography>
                <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
                  <Chip
                    label={`${progress.returnedItems}/${progress.totalItems} devueltos`}
                    color="primary"
                    size="small"
                  />
                  {progress.openItems > 0 ? (
                    <Chip
                      label={`${progress.openItems} pendientes`}
                      color="warning"
                      size="small"
                      variant="outlined"
                    />
                  ) : null}
                  {progress.damageCount > 0 ? (
                    <Chip label={`${progress.damageCount} con daños`} color="error" size="small" />
                  ) : null}
                </Stack>
                <Stack mt={2} gap={0.5}>
                  {deliveryProgress(items).returnedItems === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Aún no se registró ninguna devolución.
                    </Typography>
                  ) : null}
                  {deliveryProgress(items).returnedItems > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {deliveryProgress(items).returnedItems} item(s) devuelto(s).
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
            {request ? (
              <Card>
                <CardContent>
                  <Typography variant="h2">Solicitud</Typography>
                  <Stack mt={1.5} gap={0.5}>
                    <Typography fontWeight={700}>{request.requesterName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {request.description}
                    </Typography>
                    {request.eventStart ? (
                      <Typography variant="body2" color="text.secondary">
                        Evento: {formatDate(request.eventStart)} → {formatDate(request.eventEnd)}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Divider sx={{ my: 1.5 }} />
                  <Button
                    component={Link}
                    to={`/requests/${request.id}`}
                    size="small"
                    endIcon={<ArrowBack sx={{ transform: 'rotate(180deg)' }} />}
                  >
                    Ver solicitud
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            {delivery.notes ? (
              <Card>
                <CardContent>
                  <Typography variant="h2">Notas de la entrega</Typography>
                  <Typography mt={1}>{delivery.notes}</Typography>
                </CardContent>
              </Card>
            ) : null}
          </Stack>
        </Grid>
      </Grid>

      {returning ? (
        <ReturnDialog
          item={returning}
          open={Boolean(returning)}
          onClose={() => setReturning(null)}
          onSubmit={onConfirmReturn}
          isPending={returnMutation.isPending}
        />
      ) : null}
    </Stack>
  );
}
