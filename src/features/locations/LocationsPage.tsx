import { useMemo, useState } from 'react';
import { Place, Search } from '@mui/icons-material';
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
import { useLocations, type LocationDto, type LocationFilters } from '../../integrations/data';

function LocationCard({ location }: { location: LocationDto }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={Link} to={`/locations/${location.id}`} sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <Place color="primary" />
            <Typography fontWeight={750} fontSize="1.05rem">
              {location.name}
            </Typography>
          </Stack>
          {location.description ? (
            <Typography variant="body2" color="text.secondary" mb={1.5}>
              {location.description}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {typeof location.capacity === 'number' ? (
              <Chip size="small" variant="outlined" label={`Capacidad ${location.capacity}`} />
            ) : null}
            <Chip
              size="small"
              color={location.active ? 'success' : 'default'}
              label={location.active ? 'Activo' : 'Inactivo'}
            />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function LocationsPage() {
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const filters: LocationFilters = useMemo(
    () => (activeOnly ? { active: true } : {}),
    [activeOnly],
  );
  const locations = useLocations(filters);

  const visible = useMemo(() => {
    const list = locations.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((l) => l.name.toLowerCase().includes(q));
  }, [locations.data, search]);

  return (
    <Stack spacing={3}>
      <Box>
        <Chip label="PR 1B · Espacios" color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          Espacios
        </Typography>
        <Typography color="text.secondary">
          Disponibilidad, capacidad y reglas de reserva por sede.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar espacio…"
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
          SelectProps={{ native: true }}
          value={activeOnly ? 'ACTIVE' : 'ALL'}
          onChange={(e) => setActiveOnly(e.target.value === 'ACTIVE')}
          sx={{ minWidth: 200 }}
        >
          <option value="ACTIVE">Solo activos</option>
          <option value="ALL">Todos</option>
        </TextField>
      </Stack>

      {locations.error ? (
        <Alert severity="warning">No se pudo cargar la lista de espacios.</Alert>
      ) : null}

      {locations.isLoading ? (
        <Grid container spacing={2}>
          {[0, 1, 2].map((i) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={i}>
              <Skeleton variant="rounded" height={140} />
            </Grid>
          ))}
        </Grid>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent>
            <Typography fontWeight={700}>Sin espacios</Typography>
            <Typography color="text.secondary" mt={0.5}>
              Ajustá los filtros para ver espacios disponibles.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {visible.map((l) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={l.id}>
              <LocationCard location={l} />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
