import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  useAddQuote,
  useSuppliers,
  type AddQuoteInput,
  type QuoteDto,
  type SupplierDto,
} from '../../integrations/data';

export interface AddQuoteDialogProps {
  open: boolean;
  purchaseRequestId: string;
  onClose: () => void;
  onAdded?: (quote: QuoteDto) => void;
}

interface QuoteDraft {
  supplierId: string;
  price: string;
  currency: string;
  qualityScore: number;
  deliveryDays: string;
  warrantyMonths: string;
  technicalFitScore: number;
  notes: string;
}

const EMPTY: QuoteDraft = {
  supplierId: '',
  price: '',
  currency: 'ARS',
  qualityScore: 80,
  deliveryDays: '5',
  warrantyMonths: '6',
  technicalFitScore: 75,
  notes: '',
};

export function AddQuoteDialog({ open, purchaseRequestId, onClose, onAdded }: AddQuoteDialogProps) {
  const { data: suppliers } = useSuppliers();
  const addQuote = useAddQuote();
  const [draft, setDraft] = useState<QuoteDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({ ...EMPTY, supplierId: suppliers?.[0]?.id ?? '' });
      setError(null);
    }
  }, [open, suppliers]);

  const activeSuppliers = useMemo<SupplierDto[]>(
    () => (suppliers ?? []).filter((s) => s.active),
    [suppliers],
  );

  const submit = async () => {
    if (!draft.supplierId) {
      setError('Elegí un proveedor.');
      return;
    }
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) {
      setError('El precio debe ser un número positivo.');
      return;
    }
    const deliveryDays = Number(draft.deliveryDays);
    if (!Number.isInteger(deliveryDays) || deliveryDays < 0) {
      setError('Plazo de entrega inválido.');
      return;
    }
    const warrantyMonths = Number(draft.warrantyMonths);
    if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0) {
      setError('Garantía inválida.');
      return;
    }
    const payload: AddQuoteInput = {
      purchaseRequestId,
      supplierId: draft.supplierId,
      price,
      currency: draft.currency || 'ARS',
      qualityScore: draft.qualityScore,
      deliveryDays,
      warrantyMonths,
      technicalFitScore: draft.technicalFitScore,
      notes: draft.notes.trim() || undefined,
    };
    setError(null);
    const created = await addQuote.mutateAsync(payload);
    if (created) {
      onAdded?.(created);
      onClose();
    } else {
      setError('No se pudo registrar la cotización.');
    }
  };

  return (
    <Dialog open={open} onClose={addQuote.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nueva cotización</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="warning">{error}</Alert>}
          {activeSuppliers.length === 0 && (
            <Alert severity="info">
              No tenés proveedores activos. Cargá uno desde la sección Proveedores antes de cotizar.
            </Alert>
          )}
          <TextField
            select
            label="Proveedor"
            value={draft.supplierId}
            onChange={(e) => setDraft((d) => ({ ...d, supplierId: e.target.value }))}
            required
            fullWidth
            disabled={activeSuppliers.length === 0}
          >
            {activeSuppliers.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} {s.rating !== undefined ? `· ★ ${s.rating.toFixed(1)}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              label="Precio"
              type="number"
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
              fullWidth
              required
              inputProps={{ min: 0, step: 100 }}
            />
            <TextField
              label="Moneda"
              value={draft.currency}
              onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
              sx={{ maxWidth: 120 }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              label="Plazo de entrega (días)"
              type="number"
              value={draft.deliveryDays}
              onChange={(e) => setDraft((d) => ({ ...d, deliveryDays: e.target.value }))}
              fullWidth
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Garantía (meses)"
              type="number"
              value={draft.warrantyMonths}
              onChange={(e) => setDraft((d) => ({ ...d, warrantyMonths: e.target.value }))}
              fullWidth
              inputProps={{ min: 0 }}
            />
          </Stack>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Calidad (0-100)
              </Typography>
              <Typography fontWeight={700}>{draft.qualityScore}</Typography>
            </Stack>
            <Slider
              value={draft.qualityScore}
              onChange={(_, v) => setDraft((d) => ({ ...d, qualityScore: Number(v) }))}
              min={0}
              max={100}
              step={1}
              valueLabelDisplay="auto"
            />
          </Box>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Ajuste técnico (0-100)
              </Typography>
              <Typography fontWeight={700}>{draft.technicalFitScore}</Typography>
            </Stack>
            <Slider
              value={draft.technicalFitScore}
              onChange={(_, v) => setDraft((d) => ({ ...d, technicalFitScore: Number(v) }))}
              min={0}
              max={100}
              step={1}
              valueLabelDisplay="auto"
            />
          </Box>
          <TextField
            label="Notas (opcional)"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={addQuote.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={addQuote.isPending || activeSuppliers.length === 0}
        >
          {addQuote.isPending ? 'Guardando…' : 'Agregar cotización'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
