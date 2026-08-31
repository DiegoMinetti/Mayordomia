import { useMemo, useState } from 'react';
import {
  ArrowBack,
  CheckCircle,
  ErrorOutline,
  Gavel,
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
  Divider,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { usePurchaseRequest } from '../../integrations/data';
import {
  DEFAULT_PURCHASE_WEIGHTS,
  formatScoreBreakdown,
  purchaseStatusColor,
  purchaseStatusLabel,
  quoteStatusColor,
  quoteStatusLabel,
  scoreQuotes,
  type QuoteAssessment,
} from '../../domain/purchasing';
import { AddQuoteDialog } from './AddQuoteDialog';
import { DecideDialog } from './DecideDialog';

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function statusIcon(status: string) {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return <CheckCircle />;
    case 'REJECTED':
    case 'CANCELLED':
      return <ErrorOutline />;
    default:
      return <HourglassEmpty />;
  }
}

export function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = usePurchaseRequest(id);
  const [addingQuote, setAddingQuote] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const assessments: QuoteAssessment[] = useMemo(() => {
    if (!data?.quotes.length) return [];
    return data.quotes.map((q) => ({
      quoteId: q.id,
      price: q.price,
      quality: q.qualityScore,
      delivery: q.deliveryDays,
      warranty: q.warrantyMonths,
      supplierHistory: 50, // server uses actual supplier rating; preview is neutral.
      technicalFit: q.technicalFitScore,
    }));
  }, [data?.quotes]);

  const previewScores = useMemo(() => {
    if (!assessments.length) return [];
    try {
      return scoreQuotes(assessments, DEFAULT_PURCHASE_WEIGHTS);
    } catch {
      return [];
    }
  }, [assessments]);

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
      : 'Solicitud de compra no encontrada.';
    return (
      <Stack spacing={2}>
        <Button
          component={Link}
          to="/purchases"
          startIcon={<ArrowBack />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Volver a compras
        </Button>
        <Alert severity="error">{message}</Alert>
      </Stack>
    );
  }

  const { request, items, quotes, decision } = data;
  const isClosed = ['APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'].includes(request.status);
  const canAddQuote = !isClosed;
  const canDecide = quotes.length > 0 && !decision;

  const decisionOverriding = decision
    ? decision.justification && decision.justification.length > 0
    : false;

  return (
    <Stack spacing={3}>
      <Button
        component={Link}
        to="/purchases"
        startIcon={<ArrowBack />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Volver a compras
      </Button>

      <Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={purchaseStatusLabel(request.status)}
            color={purchaseStatusColor(request.status)}
            icon={statusIcon(request.status)}
          />
          {request.needId && (
            <Tooltip title={`Vinculada a la necesidad ${request.needId}`}>
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label="Vinculada a mantenimiento"
                icon={<ReportProblem fontSize="small" />}
              />
            </Tooltip>
          )}
        </Stack>
        <Typography variant="h1" mt={1}>
          {request.title}
        </Typography>
        {request.description && (
          <Typography color="text.secondary" mt={0.5}>
            {request.description}
          </Typography>
        )}
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h2">Información general</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1.5}>
            <DetailRow label="Solicitante" value={request.requesterId || '—'} />
            <DetailRow label="Sede" value={request.siteId || '—'} />
            <DetailRow label="Creada" value={formatDate(request.createdAt)} />
            <DetailRow label="Actualizada" value={formatDate(request.updatedAt)} />
            <DetailRow label="Versión" value={String(request.version)} />
            <DetailRow label="Estimado total" value={formatCurrency(request.estimatedTotal)} />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h2">Ítems solicitados</Typography>
            <Chip size="small" label={`${items.length} ítem(s)`} />
          </Stack>
          <TableContainer>
            <Table size="small" aria-label="Ítems">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell>Unidad</TableCell>
                  <TableCell align="right">Costo est.</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">
                        Esta compra no tiene ítems cargados.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Typography fontWeight={700}>{it.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {it.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{it.quantity}</TableCell>
                    <TableCell>{it.unit}</TableCell>
                    <TableCell align="right">{formatCurrency(it.estimatedCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            mb={1}
            gap={1}
          >
            <Typography variant="h2">Cotizaciones</Typography>
            <Stack direction="row" gap={1}>
              <Chip size="small" label={`${quotes.length} cotización(es)`} variant="outlined" />
              <Button
                size="small"
                variant="outlined"
                onClick={() => setAddingQuote(true)}
                disabled={!canAddQuote}
              >
                Agregar cotización
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<Gavel />}
                onClick={() => setDeciding(true)}
                disabled={!canDecide}
              >
                Decidir
              </Button>
            </Stack>
          </Stack>

          {!canDecide && !decision && quotes.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ya podés decidir esta compra.
            </Alert>
          )}

          {quotes.length === 0 && (
            <Typography color="text.secondary">
              Todavía no hay cotizaciones. Agregá al menos una para habilitar la decisión.
            </Typography>
          )}

          {quotes.length > 0 && (
            <Stack spacing={1.5}>
              {previewScores.map((score) => {
                const q = quotes.find((qq) => qq.id === score.quoteId)!;
                const isChosen = decision?.chosenQuoteId === q.id;
                return (
                  <Box
                    key={q.id}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: isChosen ? 'primary.main' : '#eee',
                      borderRadius: 2,
                      backgroundColor: isChosen ? 'rgba(33,78,70,0.04)' : 'transparent',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ sm: 'center' }}
                      gap={1}
                    >
                      <Box>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography fontWeight={700}>{q.supplierName || q.supplierId}</Typography>
                          <Chip
                            size="small"
                            color={quoteStatusColor(q.status)}
                            label={quoteStatusLabel(q.status)}
                            variant={q.status === 'PENDING' ? 'outlined' : 'filled'}
                          />
                          {isChosen && <Chip size="small" color="primary" label="Elegida" />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {q.currency} {q.price.toLocaleString('es-AR')} · entrega {q.deliveryDays}d
                          · garantía {q.warrantyMonths}m
                        </Typography>
                        {q.notes && (
                          <Typography variant="body2" mt={0.5}>
                            “{q.notes}”
                          </Typography>
                        )}
                      </Box>
                      <Box textAlign={{ sm: 'right' }}>
                        <Typography fontWeight={800} fontSize="1.25rem">
                          {score.score.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          score total
                        </Typography>
                      </Box>
                    </Stack>
                    <Box mt={1}>
                      <Stack direction="row" gap={2} flexWrap="wrap">
                        {formatScoreBreakdown(score).map((row) => (
                          <Tooltip key={row.key} title={row.description}>
                            <Box sx={{ minWidth: 100 }}>
                              <Typography variant="caption" color="text.secondary">
                                {row.label}
                              </Typography>
                              <Typography fontWeight={600}>
                                {row.normalized.toFixed(1)}% · {row.contribution.toFixed(2)} pts
                              </Typography>
                            </Box>
                          </Tooltip>
                        ))}
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {decision && (
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" gap={1} mb={1}>
              <Gavel color="primary" />
              <Typography variant="h2">Decisión registrada</Typography>
            </Stack>
            <Stack spacing={1.5}>
              <DetailRow
                label="Cotización elegida"
                value={
                  quotes.find((q) => q.id === decision.chosenQuoteId)?.supplierName ??
                  decision.chosenQuoteId
                }
              />
              <DetailRow label="Decidida por" value={decision.decidedBy} />
              <DetailRow label="Fecha" value={formatDate(decision.decidedAt)} />
              {decision.justification && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Justificación
                  </Typography>
                  <Typography>“{decision.justification}”</Typography>
                </Box>
              )}
              {decisionOverriding && decision.scores && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Decisión con override
                  </Typography>
                  <Typography variant="body2">
                    Se eligió una cotización que no era la mejor puntuada según los pesos aplicados
                    al momento de la decisión.
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {decision && decision.justification && decision.justification.trim().length > 0 && (
        <Alert severity="info">
          La decisión se registró con un override: la cotización elegida no era la mejor puntuada.
          Revisá la justificación registrada.
        </Alert>
      )}

      <Button
        variant="text"
        size="small"
        sx={{ alignSelf: 'flex-start' }}
        onClick={() => void refetch()}
      >
        Recargar
      </Button>

      <AddQuoteDialog
        open={addingQuote}
        purchaseRequestId={request.id}
        onClose={() => setAddingQuote(false)}
        onAdded={() => void refetch()}
      />
      <DecideDialog
        open={deciding}
        purchaseRequestId={request.id}
        quotes={quotes}
        onClose={() => setDeciding(false)}
        onDecided={() => void refetch()}
      />
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
        {label}
      </Typography>
      <Typography>{value}</Typography>
    </Stack>
  );
}
