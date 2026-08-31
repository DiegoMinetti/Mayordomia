import { useState } from 'react';
import { Add, DeleteOutline } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  CreatePurchaseItemInput,
  CreatePurchaseRequestInput,
  PurchaseRequestDetailDto,
} from '../../integrations/data';

export interface NewPurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreatePurchaseRequestInput) => Promise<PurchaseRequestDetailDto | null>;
  saving: boolean;
}

interface ItemDraft {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  estimatedCost: string;
}

const EMPTY_ITEM: ItemDraft = {
  name: '',
  description: '',
  quantity: '1',
  unit: 'unidad',
  estimatedCost: '',
};

export function NewPurchaseDialog({ open, onClose, onCreate, saving }: NewPurchaseDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState<string | null>(null);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);

  const submit = async () => {
    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (items.length === 0) {
      setError('Agregá al menos un ítem.');
      return;
    }
    const cleaned: CreatePurchaseItemInput[] = [];
    for (const it of items) {
      if (!it.name.trim()) {
        setError('Cada ítem necesita un nombre.');
        return;
      }
      const q = Number(it.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        setError(`Cantidad inválida para "${it.name}".`);
        return;
      }
      const est = it.estimatedCost === '' ? undefined : Number(it.estimatedCost);
      if (est !== undefined && (!Number.isFinite(est) || est < 0)) {
        setError(`Costo estimado inválido para "${it.name}".`);
        return;
      }
      cleaned.push({
        name: it.name.trim(),
        description: it.description.trim() || undefined,
        quantity: q,
        unit: it.unit.trim() || 'unidad',
        estimatedCost: est,
      });
    }
    setError(null);
    await onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      items: cleaned,
    });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Nueva compra</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="warning">{error}</Alert>}
          <TextField
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            fullWidth
          />
          <TextField
            label="Descripción general"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography fontWeight={700}>Ítems</Typography>
              <Button size="small" startIcon={<Add />} onClick={addItem}>
                Agregar ítem
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              {items.map((it, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1.5,
                    border: '1px solid #eee',
                    borderRadius: 2,
                    backgroundColor: 'background.default',
                  }}
                >
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 28 }}>
                      {idx + 1}.
                    </Typography>
                    <TextField
                      label="Nombre"
                      value={it.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      size="small"
                      fullWidth
                      required
                    />
                    <TextField
                      label="Cant."
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                      size="small"
                      sx={{ width: 80 }}
                      inputProps={{ min: 1 }}
                    />
                    <TextField
                      label="Unidad"
                      value={it.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      size="small"
                      sx={{ width: 110 }}
                    />
                    <TextField
                      label="Costo est."
                      type="number"
                      value={it.estimatedCost}
                      onChange={(e) => updateItem(idx, { estimatedCost: e.target.value })}
                      size="small"
                      sx={{ width: 130 }}
                      inputProps={{ min: 0, step: 100 }}
                    />
                    <IconButton
                      onClick={() => removeItem(idx)}
                      size="small"
                      disabled={items.length === 1}
                      aria-label="Quitar ítem"
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Stack>
                  <TextField
                    label="Descripción del ítem (opcional)"
                    value={it.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    size="small"
                    fullWidth
                    sx={{ mt: 1 }}
                  />
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving}>
          {saving ? 'Creando…' : 'Crear compra'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
