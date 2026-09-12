import { useMemo, useState } from 'react';
import { Add, Search, Star, Storefront } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSuppliers, useUpsertSupplier, type SupplierDto } from '../../integrations/data';
import { SupplierDialog } from './SupplierDialog';

function RatingChip({ value }: { value: number | undefined }) {
  if (value === undefined || value === null)
    return <Typography color="text.secondary">—</Typography>;
  return (
    <Stack direction="row" gap={0.25} alignItems="center">
      <Star fontSize="small" color="warning" />
      <Typography fontWeight={600}>{value.toFixed(1)}</Typography>
    </Stack>
  );
}

export function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [editing, setEditing] = useState<SupplierDto | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, error } = useSuppliers();
  const upsert = useUpsertSupplier();

  const visible = useMemo(() => {
    const list = data ?? [];
    const q = search.toLowerCase().trim();
    return list.filter((s) => {
      if (activeOnly && !s.active) return false;
      if (!q) return true;
      const haystack = `${s.name} ${s.contactName ?? ''} ${s.email ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search, activeOnly]);

  const onSave = async (
    input: Parameters<typeof upsert.mutateAsync>[0],
  ): Promise<SupplierDto | null> => {
    try {
      const saved = await upsert.mutateAsync(input);
      setCreating(false);
      setEditing(null);
      return saved;
    } catch (err) {
      console.error('upsertSupplier failed', err);
      return null;
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Chip label="Ola 3b · Compras" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Proveedores
        </Typography>
        <Typography color="text.secondary">
          Mantené actualizada la información de tus proveedores para acelerar cotizaciones y
          decisiones.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por nombre, contacto o email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              size="small"
              label="Visibilidad"
              slotProps={{ select: { native: true } }}
              value={activeOnly ? 'ACTIVE' : 'ALL'}
              onChange={(e) => setActiveOnly(e.target.value === 'ACTIVE')}
              sx={{ minWidth: 180 }}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Solo activos</option>
            </TextField>
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreating(true)}>
              Nuevo proveedor
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {isError && (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'No se pudo cargar la lista de proveedores.'}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small" aria-label="Proveedores">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Contacto</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell colSpan={7}>
                      <Skeleton variant="text" height={32} />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box textAlign="center" py={6}>
                      <Stack alignItems="center" gap={1}>
                        <Storefront color="disabled" sx={{ fontSize: 48 }} />
                        <Typography variant="h2">Sin proveedores</Typography>
                        <Typography color="text.secondary" maxWidth={420}>
                          Cargá tus primeros proveedores para poder recibir cotizaciones.
                        </Typography>
                      </Stack>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {visible.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{s.name}</Typography>
                    {s.notes && (
                      <Tooltip title={s.notes}>
                        <Typography variant="body2" color="text.secondary" noWrap maxWidth={260}>
                          {s.notes}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>{s.contactName || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{s.email || '—'}</Typography>
                  </TableCell>
                  <TableCell>{s.phone || '—'}</TableCell>
                  <TableCell>
                    <RatingChip value={s.rating} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={s.active ? 'Activo' : 'Inactivo'}
                      color={s.active ? 'success' : 'default'}
                      variant={s.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setEditing(s)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <SupplierDialog
        open={creating || Boolean(editing)}
        supplier={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={onSave}
        saving={upsert.isPending}
      />
    </Stack>
  );
}
