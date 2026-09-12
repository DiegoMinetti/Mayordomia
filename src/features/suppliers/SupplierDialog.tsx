import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SupplierDto, UpsertSupplierInput } from '../../integrations/data';

export interface SupplierDialogProps {
  open: boolean;
  supplier: SupplierDto | null;
  onClose: () => void;
  onSave: (input: UpsertSupplierInput) => Promise<SupplierDto | null>;
  saving: boolean;
}

const EMPTY: UpsertSupplierInput = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
  rating: undefined,
  active: true,
};

export function SupplierDialog({ open, supplier, onClose, onSave, saving }: SupplierDialogProps) {
  const [draft, setDraft] = useState<UpsertSupplierInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (supplier) {
      setDraft({
        id: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName ?? '',
        email: supplier.email ?? '',
        phone: supplier.phone ?? '',
        notes: supplier.notes ?? '',
        rating: supplier.rating,
        active: supplier.active,
      });
    } else {
      setDraft(EMPTY);
    }
    setError(null);
  }, [open, supplier]);

  const submit = async () => {
    if (!draft.name?.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      setError('Email inválido.');
      return;
    }
    if (draft.rating !== undefined && (draft.rating < 0 || draft.rating > 5)) {
      setError('El rating debe estar entre 0 y 5.');
      return;
    }
    setError(null);
    await onSave(draft);
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="warning">{error}</Alert>}
          <TextField
            label="Nombre comercial"
            value={draft.name ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            fullWidth
            required
            autoFocus
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              label="Persona de contacto"
              value={draft.contactName ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={draft.email ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              label="Teléfono"
              value={draft.phone ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Rating (0-5)"
              type="number"
              value={draft.rating === undefined ? '' : String(draft.rating)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  rating: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
              inputProps={{ min: 0, max: 5, step: 0.1 }}
              fullWidth
            />
          </Stack>
          <TextField
            label="Notas internas"
            value={draft.notes ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            select
            label="Estado"
            value={draft.active ? 'ACTIVE' : 'INACTIVE'}
            onChange={(e) => setDraft((d) => ({ ...d, active: e.target.value === 'ACTIVE' }))}
            sx={{ maxWidth: 220 }}
          >
            <MenuItem value="ACTIVE">Activo</MenuItem>
            <MenuItem value="INACTIVE">Inactivo</MenuItem>
          </TextField>
          {supplier && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Versión {supplier.version} — guardá con cuidado para evitar pisar cambios de otros
                usuarios.
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
