import { useCallback, useMemo } from 'react';
import {
  ArrowBack,
  Build,
  Image as ImageIcon,
  Place,
  Print,
  ReportProblem,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  useLocation,
  useReservations,
  useResource,
  useResourceMovements,
  useSites,
  type ReservationDto,
} from '../../integrations/data';
import {
  inventoryTypeLabel,
  movementTypeLabel,
  reservationStatusLabel,
  resourceStatusColor,
  resourceStatusLabel,
} from '../../domain/resource';

function formatRange(r: ReservationDto) {
  const start = new Date(r.startAt);
  const end = new Date(r.endAt);
  const fmt = (d: Date) => d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  return `${fmt(start)} → ${fmt(end)}`;
}

function QrLabel({ id, name, code }: { id: string; name: string; code?: string }) {
  return (
    <Box
      sx={{
        p: 3,
        border: '2px dashed #214E46',
        borderRadius: 2,
        textAlign: 'center',
        maxWidth: 320,
        bgcolor: 'background.paper',
      }}
    >
      <ImageIcon sx={{ fontSize: 96, color: 'primary.main' }} />
      <Typography variant="h2" mt={1}>
        {name}
      </Typography>
      <Typography color="text.secondary">ID: {id}</Typography>
      {code ? <Typography color="text.secondary">Código interno: {code}</Typography> : null}
      <Typography variant="body2" color="text.secondary" mt={1}>
        Pegar sobre el recurso para escaneo en solicitudes públicas.
      </Typography>
    </Box>
  );
}

export function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resource = useResource(id);
  const movements = useResourceMovements(id);
  const reservations = useReservations({ targetId: id });
  const location = useLocation(resource.data?.locationId);
  const sites = useSites();

  const siteName = useMemo(() => {
    if (!resource.data?.siteId) return undefined;
    return sites.data?.find((s) => s.id === resource.data?.siteId)?.name;
  }, [resource.data?.siteId, sites.data]);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') window.print();
  }, []);

  const handleReport = useCallback(() => {
    // Placeholder for the future "Reportar falla" flow (PR 1C/1D).
    // Kept here as a console hook so the button is exercisable in dev.
    if (typeof window !== 'undefined') {
      console.info('[resources] reportar falla solicitado', { id });
    }
  }, [id]);

  if (resource.isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" height={48} width="60%" />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  if (!resource.data) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning">No encontramos este recurso.</Alert>
        <Button component={RouterLink} to="/resources" startIcon={<ArrowBack />}>
          Volver al inventario
        </Button>
      </Stack>
    );
  }

  const r = resource.data;
  const upcoming = (reservations.data ?? [])
    .filter((res) => new Date(res.endAt).getTime() > Date.now() && res.status !== 'CANCELLED')
    .slice(0, 5);

  return (
    <Stack spacing={3} className="resource-detail">
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button
          component={RouterLink}
          to="/resources"
          startIcon={<ArrowBack />}
          size="small"
          variant="text"
        >
          Volver
        </Button>
      </Stack>

      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={resourceStatusColor(r.status)}
            label={resourceStatusLabel(r.status)}
          />
          <Chip size="small" variant="outlined" label={inventoryTypeLabel(r.inventoryType)} />
          {r.inventoryType === 'QUANTITY' ? (
            <Chip size="small" variant="outlined" label={`${r.quantity} ${r.unit}`} />
          ) : null}
          {siteName ? <Chip size="small" variant="outlined" label={siteName} /> : null}
        </Stack>
        <Typography variant="h1" mt={1}>
          {r.name}
        </Typography>
        {r.description ? <Typography color="text.secondary">{r.description}</Typography> : null}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h2">Identificación</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Código interno
                    </Typography>
                    <Typography fontWeight={700}>{r.internalCode ?? '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      N° de serie
                    </Typography>
                    <Typography fontWeight={700}>{r.serialNumber ?? '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Marca / modelo
                    </Typography>
                    <Typography fontWeight={700}>
                      {[r.brand, r.model].filter(Boolean).join(' · ') || '—'}
                    </Typography>
                  </Grid>
                  {r.purchaseDate ? (
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Fecha de compra
                      </Typography>
                      <Typography fontWeight={700}>
                        {new Date(r.purchaseDate).toLocaleDateString('es-AR')}
                      </Typography>
                    </Grid>
                  ) : null}
                  {typeof r.purchaseCost === 'number' ? (
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Costo
                      </Typography>
                      <Typography fontWeight={700}>
                        {r.purchaseCost.toLocaleString('es-AR', {
                          style: 'currency',
                          currency: 'ARS',
                        })}
                      </Typography>
                    </Grid>
                  ) : null}
                  {r.warrantyUntil ? (
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Garantía hasta
                      </Typography>
                      <Typography fontWeight={700}>
                        {new Date(r.warrantyUntil).toLocaleDateString('es-AR')}
                      </Typography>
                    </Grid>
                  ) : null}
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Place color="primary" />
                  <Typography variant="h2">Ubicación actual</Typography>
                </Stack>
                {location.data ? (
                  <Typography>
                    <RouterLink to={`/locations/${location.data.id}`}>
                      {location.data.name}
                    </RouterLink>
                    {location.data.description ? ` — ${location.data.description}` : ''}
                  </Typography>
                ) : (
                  <Typography color="text.secondary">
                    Sin ubicación asignada o el espacio no está activo.
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h2">Próximas reservas</Typography>
                <Divider sx={{ my: 1.5 }} />
                {upcoming.length === 0 ? (
                  <Typography color="text.secondary">
                    Sin reservas próximas para este recurso.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {upcoming.map((res) => (
                      <Stack
                        key={res.id}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ borderTop: '1px solid #eee', py: 1 }}
                      >
                        <Box>
                          <Typography fontWeight={700}>{formatRange(res)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Cantidad: {res.quantity}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={reservationStatusLabel(res.status)}
                          color={res.status === 'CONFIRMED' ? 'success' : 'warning'}
                        />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Build color="primary" />
                  <Typography variant="h2">Movimientos recientes</Typography>
                </Stack>
                {movements.isLoading ? (
                  <Skeleton variant="rounded" height={80} />
                ) : (movements.data ?? []).length === 0 ? (
                  <Typography color="text.secondary">Sin movimientos registrados.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {(movements.data ?? []).slice(0, 10).map((m) => (
                      <Stack
                        key={m.id}
                        direction="row"
                        justifyContent="space-between"
                        sx={{ borderTop: '1px solid #eee', py: 1 }}
                      >
                        <Box>
                          <Typography fontWeight={700}>{movementTypeLabel(m.type)}</Typography>
                          {m.reason ? (
                            <Typography variant="body2" color="text.secondary">
                              {m.reason}
                            </Typography>
                          ) : null}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(m.occurredAt).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h2">Acciones</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  <Button variant="contained" startIcon={<Print />} onClick={handlePrint} fullWidth>
                    Imprimir QR
                  </Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<ReportProblem />}
                    onClick={handleReport}
                    fullWidth
                  >
                    Reportar falla
                  </Button>
                  <Button variant="text" onClick={() => navigate('/requests')} fullWidth>
                    Crear solicitud vinculada
                  </Button>
                </Stack>
              </CardContent>
            </Card>
            <Box className="printable-qr">
              <QrLabel id={r.id} name={r.name} code={r.internalCode} />
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
