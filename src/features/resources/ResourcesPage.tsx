import { useMemo, useState } from 'react';
import { Inventory2, QrCode2, Search } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  useResources,
  useSites,
  type ResourceDto,
  type ResourceFilters,
  type ResourceInventoryType,
  type ResourceStatusDto,
} from '../../integrations/data';
import {
  groupResourcesByType,
  inventoryTypeLabel,
  resourceStatusColor,
  resourceStatusLabel,
} from '../../domain/resource';

const STATUS_FILTERS: { label: string; value: ResourceStatusDto | 'ALL' }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Disponibles', value: 'AVAILABLE' },
  { label: 'En uso', value: 'IN_USE' },
  { label: 'Devolución pendiente', value: 'RETURN_PENDING' },
  { label: 'Mantenimiento', value: 'MAINTENANCE' },
  { label: 'Roto', value: 'BROKEN' },
  { label: 'Faltante', value: 'MISSING' },
];

const TYPE_FILTERS: { label: string; value: ResourceInventoryType | 'ALL' }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Serializado', value: 'SERIALIZED' },
  { label: 'Por cantidad', value: 'QUANTITY' },
];

function ResourceCard({ resource }: { resource: ResourceDto }) {
  const detailPath = `/resources/${resource.id}`;
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={Link} to={detailPath} sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <Inventory2 color="primary" />
            <Typography fontWeight={750} fontSize="1.05rem">
              {resource.name}
            </Typography>
          </Stack>
          {resource.brand || resource.model ? (
            <Typography variant="body2" color="text.secondary">
              {[resource.brand, resource.model].filter(Boolean).join(' · ')}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color={resourceStatusColor(resource.status)}
              label={resourceStatusLabel(resource.status)}
            />
            <Chip
              size="small"
              variant="outlined"
              label={inventoryTypeLabel(resource.inventoryType)}
            />
            {resource.inventoryType === 'QUANTITY' ? (
              <Chip
                size="small"
                variant="outlined"
                label={`${resource.quantity} ${resource.unit}`}
              />
            ) : null}
            {resource.internalCode ? (
              <Chip
                size="small"
                variant="outlined"
                icon={<QrCode2 />}
                label={resource.internalCode}
              />
            ) : null}
          </Stack>
          {resource.description ? (
            <Typography variant="body2" color="text.secondary" mt={1.5}>
              {resource.description}
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ResourceGroup({
  title,
  description,
  resources,
}: {
  title: string;
  description: string;
  resources: ResourceDto[];
}) {
  if (resources.length === 0) return null;
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="h2">{title}</Typography>
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        </Box>
        <Chip label={resources.length} size="small" />
      </Stack>
      <Grid container spacing={2}>
        {resources.map((r) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={r.id}>
            <ResourceCard resource={r} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export function ResourcesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResourceStatusDto | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<ResourceInventoryType | 'ALL'>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');

  const filters: ResourceFilters = useMemo(() => {
    const f: ResourceFilters = {};
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (typeFilter !== 'ALL') f.kind = typeFilter;
    if (siteFilter !== 'ALL') f.siteId = siteFilter;
    return f;
  }, [statusFilter, typeFilter, siteFilter]);

  const sites = useSites();
  const resources = useResources(filters);

  const visible = useMemo(() => {
    const list = resources.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.internalCode ?? '').toLowerCase().includes(q) ||
        (r.serialNumber ?? '').toLowerCase().includes(q) ||
        (r.brand ?? '').toLowerCase().includes(q),
    );
  }, [resources.data, search]);

  const grouped = useMemo(() => groupResourcesByType(visible), [visible]);

  return (
    <Stack spacing={3}>
      <Box>
        <Chip label="PR 1B · Recursos" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Recursos
        </Typography>
        <Typography color="text.secondary">
          Inventario serializado y por cantidad, con historial de movimientos.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por nombre, código o serie…"
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
          label="Estado"
          SelectProps={{ native: true }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ResourceStatusDto | 'ALL')}
          sx={{ minWidth: 200 }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Tipo"
          SelectProps={{ native: true }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ResourceInventoryType | 'ALL')}
          sx={{ minWidth: 200 }}
        >
          {TYPE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Sede"
          SelectProps={{ native: true }}
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <option value="ALL">Todas las sedes</option>
          {(sites.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </TextField>
      </Stack>

      {resources.error ? (
        <Alert severity="warning">No se pudo cargar el inventario en este momento.</Alert>
      ) : null}

      {resources.isLoading ? (
        <Grid container spacing={2}>
          {[0, 1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={i}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
          ))}
        </Grid>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent>
            <Typography fontWeight={700}>Sin resultados</Typography>
            <Typography color="text.secondary" mt={0.5}>
              Ajustá los filtros o el texto de búsqueda para encontrar recursos.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={4}>
          <ResourceGroup
            title="Serializados"
            description="Equipos identificados individualmente (proyectores, consolas, micrófonos)."
            resources={grouped.SERIALIZED}
          />
          <ResourceGroup
            title="Por cantidad"
            description="Insumos y consumibles con stock disponible."
            resources={grouped.QUANTITY}
          />
        </Stack>
      )}
    </Stack>
  );
}
