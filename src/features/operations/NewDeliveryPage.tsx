import { useEffect, useMemo, useState } from 'react';
import { ArrowBack, LocalShipping } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useDeliver,
  useRequest,
  useResources,
  useSites,
  type DeliverPayload,
  type ResourceDto,
} from '../../integrations/data';

function newIdempotencyKey() {
  // Random UUID-like string, sufficient for the dev mock.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NewDeliveryPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requestId = params.get('requestId') || undefined;
  const { data: request, isLoading: isLoadingRequest } = useRequest(requestId);
  const sites = useSites();
  const resources = useResources();
  const deliver = useDeliver();

  const [recipientName, setRecipientName] = useState('');
  const [siteId, setSiteId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ resourceId: string; quantity: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [idemKey] = useState<string>(newIdempotencyKey());

  // Seed a sensible default once the request loads.
  useEffect(() => {
    if (request && !recipientName) {
      setRecipientName(request.requesterName);
    }
    if (request?.siteId && !siteId) setSiteId(request.siteId);
  }, [request, recipientName, siteId]);

  const availableResources = useMemo<ResourceDto[]>(
    () => (resources.data ?? []).filter((r) => r.status === 'AVAILABLE' || r.status === 'RESERVED'),
    [resources.data],
  );

  const addItem = () => {
    if (availableResources.length === 0) return;
    setItems((prev) => [...prev, { resourceId: availableResources[0].id, quantity: 1 }]);
  };

  const updateItem = (idx: number, patch: Partial<{ resourceId: string; quantity: number }>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!request) {
      setError('Cargá primero una solicitud aprobada.');
      return;
    }
    if (!recipientName.trim()) {
      setError('Indicá el destinatario.');
      return;
    }
    if (items.length === 0) {
      setError('Agregá al menos un recurso.');
      return;
    }
    setError(null);
    try {
      const payload: DeliverPayload = {
        idempotencyKey: idemKey,
        requestId: request.id,
        expectedVersion: request.version,
        deliveredBy: 'u-operador', // Mocked — would come from auth context.
        deliveredAt: new Date().toISOString(),
        siteId: siteId || undefined,
        recipientName: recipientName.trim(),
        notes: notes.trim() || undefined,
        items: items.map((it) => ({ resourceId: it.resourceId, quantity: it.quantity })),
      };
      const result = await deliver.mutateAsync(payload);
      if (result) {
        navigate(`/operations/${result.delivery.id}`);
      }
    } catch (err) {
      const e = err as { message?: string; error?: { message?: string } };
      setError(e.error?.message ?? e.message ?? 'No se pudo registrar la entrega.');
    }
  };

  if (!requestId) {
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
        <Alert severity="info">
          Elegí una solicitud aprobada desde la página de Operación para iniciar una entrega.
        </Alert>
      </Stack>
    );
  }

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
        <Chip label="Nueva entrega" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Crear entrega
        </Typography>
        <Typography color="text.secondary">
          Confirmá los recursos, destinatario y notas. Esta acción marca la solicitud como entregada
          y mueve el inventario a "Entregado" o "En uso".
        </Typography>
      </Box>

      {isLoadingRequest ? (
        <Skeleton variant="rounded" height={120} />
      ) : !request ? (
        <Alert severity="warning">No se encontró la solicitud.</Alert>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h2">Solicitud</Typography>
            <Stack mt={1.5} gap={0.5}>
              <Typography fontWeight={700}>{request.requesterName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {request.description}
              </Typography>
              <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
                <Chip size="small" label={request.type} variant="outlined" />
                <Chip
                  size="small"
                  label={`Estado: ${request.status}`}
                  color={request.status === 'APPROVED' ? 'success' : 'default'}
                />
                <Chip size="small" label={`v${request.version}`} variant="outlined" />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h2">Destinatario y sede</Typography>
          <Stack mt={2} spacing={2}>
            <TextField
              label="Destinatario"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              select
              label="Sede"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">— Heredar de la solicitud —</MenuItem>
              {(sites.data ?? []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h2">Recursos a entregar</Typography>
              <Typography variant="body2" color="text.secondary">
                Seleccioná los recursos y la cantidad a entregar.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<LocalShipping />}
              onClick={addItem}
              disabled={availableResources.length === 0}
            >
              Agregar recurso
            </Button>
          </Stack>
          {resources.isLoading ? (
            <Skeleton variant="rounded" height={80} sx={{ mt: 2 }} />
          ) : availableResources.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No hay recursos disponibles o reservados para entregar.
            </Alert>
          ) : items.length === 0 ? (
            <Typography color="text.secondary" mt={2}>
              Empezá agregando al menos un recurso.
            </Typography>
          ) : (
            <Stack mt={2} gap={1}>
              {items.map((it, idx) => (
                <Stack
                  key={idx}
                  direction={{ xs: 'column', sm: 'row' }}
                  gap={1}
                  alignItems={{ sm: 'center' }}
                >
                  <TextField
                    select
                    label="Recurso"
                    value={it.resourceId}
                    onChange={(e) => updateItem(idx, { resourceId: e.target.value })}
                    sx={{ minWidth: 280, flex: 1 }}
                  >
                    {availableResources.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.name}
                        {r.status !== 'AVAILABLE' ? ` · ${r.status}` : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Cantidad"
                    type="number"
                    inputProps={{ min: 1 }}
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                    sx={{ width: 120 }}
                  />
                  <Button color="error" onClick={() => removeItem(idx)}>
                    Quitar
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button component={Link} to="/operations">
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={!request || deliver.isPending || items.length === 0 || !recipientName.trim()}
          startIcon={deliver.isPending ? <CircularProgress size={16} /> : <LocalShipping />}
        >
          Confirmar entrega
        </Button>
      </Stack>
    </Stack>
  );
}
