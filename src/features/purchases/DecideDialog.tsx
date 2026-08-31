import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  useDecidePurchase,
  type DecidePurchaseResult,
  type PurchaseWeightsDto,
  type QuoteDto,
} from '../../integrations/data';
import {
  DEFAULT_PURCHASE_WEIGHTS,
  PURCHASE_WEIGHT_DESCRIPTIONS,
  PURCHASE_WEIGHT_LABELS,
  contributionLabel,
  formatScoreBreakdown,
  isOverridingBestQuote,
  normalizedLabel,
  scoreQuotes,
  type QuoteAssessment,
  type QuoteScore,
} from '../../domain/purchasing';

export interface DecideDialogProps {
  open: boolean;
  purchaseRequestId: string;
  quotes: QuoteDto[];
  onClose: () => void;
  onDecided?: (result: DecidePurchaseResult) => void;
}

const WEIGHT_KEYS = Object.keys(DEFAULT_PURCHASE_WEIGHTS) as (keyof PurchaseWeightsDto)[];

function buildAssessments(quotes: QuoteDto[]): QuoteAssessment[] {
  return quotes.map((q) => ({
    quoteId: q.id,
    price: q.price,
    quality: q.qualityScore,
    delivery: deliveryPreviewScore(q.deliveryDays),
    warranty: warrantyPreviewScore(q.warrantyMonths),
    // Without a supplier we treat supplier history neutrally. The server
    // recomputes the final number using the actual supplier rating; the
    // preview here is just for ordering and the override warning.
    supplierHistory: 50,
    technicalFit: q.technicalFitScore,
  }));
}

function deliveryPreviewScore(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0;
  if (days <= 3) return 100;
  if (days >= 60) return 0;
  return Math.round((1 - (days - 3) / 57) * 100);
}
function warrantyPreviewScore(months: number): number {
  if (!Number.isFinite(months) || months < 0) return 0;
  if (months >= 24) return 100;
  if (months === 0) return 30;
  return Math.round((months / 24) * 100);
}

export function DecideDialog({
  open,
  purchaseRequestId,
  quotes,
  onClose,
  onDecided,
}: DecideDialogProps) {
  const [weights, setWeights] = useState<PurchaseWeightsDto>({ ...DEFAULT_PURCHASE_WEIGHTS });
  const [chosenQuoteId, setChosenQuoteId] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decide = useDecidePurchase();

  const assessments = useMemo(() => buildAssessments(quotes), [quotes]);

  const previewScores: QuoteScore[] = useMemo(() => {
    try {
      return scoreQuotes(assessments, weights);
    } catch {
      return [];
    }
  }, [assessments, weights]);

  // Default the chosen quote to the top-scored one whenever the dialog opens
  // or the scores change.
  useEffect(() => {
    if (open && previewScores.length) {
      setChosenQuoteId((current) => current || previewScores[0].quoteId);
    }
  }, [open, previewScores]);

  const overriding = chosenQuoteId ? isOverridingBestQuote(chosenQuoteId, previewScores) : false;
  const chosenScore = previewScores.find((s) => s.quoteId === chosenQuoteId);
  const bestScore = previewScores[0];

  const onWeightChange = (key: keyof PurchaseWeightsDto, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (!chosenQuoteId) {
      setError('Elegí una cotización para decidir.');
      return;
    }
    if (overriding && !justification.trim()) {
      setError(
        'La justificación es obligatoria cuando elegís una cotización que no es la mejor puntuada.',
      );
      return;
    }
    setError(null);
    const result = await decide.mutateAsync({
      purchaseRequestId,
      chosenQuoteId,
      weights,
      justification: justification.trim() || undefined,
    });
    if (result) {
      onDecided?.(result);
      onClose();
    } else {
      setError('No se pudo registrar la decisión.');
    }
  };

  return (
    <Dialog open={open} onClose={decide.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Decidir compra</DialogTitle>
      <DialogContent>
        <Stack spacing={3} mt={1}>
          {error && <Alert severity="warning">{error}</Alert>}

          <Box>
            <Typography variant="h2">Pesos del scoring</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Ajustá la importancia relativa de cada criterio. El servidor recalcula con la
              información real del proveedor al guardar.
            </Typography>
            <Stack spacing={2} mt={2}>
              {WEIGHT_KEYS.map((key) => (
                <Box key={key}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Tooltip title={PURCHASE_WEIGHT_DESCRIPTIONS[key]}>
                      <Typography fontWeight={600}>{PURCHASE_WEIGHT_LABELS[key]}</Typography>
                    </Tooltip>
                    <Typography fontWeight={700}>{weights[key]}</Typography>
                  </Stack>
                  <Slider
                    value={weights[key]}
                    onChange={(_, v) => onWeightChange(key, Number(v))}
                    min={0}
                    max={100}
                    step={1}
                    valueLabelDisplay="auto"
                  />
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="h2">Cotizaciones</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              El puntaje se calcula con los pesos definidos arriba. La cotización con mejor puntaje
              aparece resaltada.
            </Typography>
            <Stack spacing={1.5} mt={2}>
              {previewScores.map((score) => {
                const quote = quotes.find((q) => q.id === score.quoteId)!;
                const isBest = score.quoteId === bestScore?.quoteId;
                const isChosen = score.quoteId === chosenQuoteId;
                return (
                  <Box
                    key={score.quoteId}
                    onClick={() => setChosenQuoteId(score.quoteId)}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: isChosen ? 'primary.main' : isBest ? 'success.main' : '#eee',
                      borderRadius: 2,
                      cursor: 'pointer',
                      backgroundColor: isChosen
                        ? 'rgba(33,78,70,0.06)'
                        : isBest
                          ? 'rgba(46,125,50,0.04)'
                          : 'background.default',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      gap={1.5}
                      alignItems={{ sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography fontWeight={700}>
                            {quote.supplierName || 'Proveedor'}
                          </Typography>
                          {isBest && <Chip size="small" color="success" label="Mejor score" />}
                          {isChosen && <Chip size="small" color="primary" label="Seleccionada" />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {quote.currency} {quote.price.toLocaleString('es-AR')} · entrega{' '}
                          {quote.deliveryDays}d · garantía {quote.warrantyMonths}m
                        </Typography>
                      </Box>
                      <Box textAlign={{ sm: 'right' }}>
                        <Typography fontWeight={800} fontSize="1.3rem">
                          {score.score.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          score total
                        </Typography>
                      </Box>
                    </Stack>
                    <Box mt={1.5}>
                      <Stack direction="row" gap={2} flexWrap="wrap">
                        {formatScoreBreakdown(score).map((row) => (
                          <Tooltip key={row.key} title={row.description}>
                            <Box sx={{ minWidth: 110 }}>
                              <Typography variant="caption" color="text.secondary">
                                {row.label}
                              </Typography>
                              <Typography fontWeight={600}>
                                {normalizedLabel(row.normalized)} ·{' '}
                                {contributionLabel(row.contribution)}
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
          </Box>

          {overriding && (
            <Alert severity="warning">
              Estás eligiendo una cotización que no es la mejor puntuada (
              {chosenScore?.score.toFixed(2)} vs {bestScore?.score.toFixed(2)}). Por favor justificá
              la decisión.
            </Alert>
          )}

          <TextField
            label="Justificación"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            required={overriding}
            helperText={
              overriding
                ? 'Obligatoria porque no estás eligiendo la mejor puntuación.'
                : 'Opcional. Visible en la auditoría.'
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={decide.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color={overriding ? 'warning' : 'primary'}
          onClick={() => void submit()}
          disabled={decide.isPending || !chosenQuoteId}
        >
          {decide.isPending ? 'Guardando…' : 'Confirmar decisión'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
