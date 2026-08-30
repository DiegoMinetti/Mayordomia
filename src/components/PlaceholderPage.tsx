import { Add, Search } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

export function PlaceholderPage({
  title,
  description,
  status = 'Base funcional',
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <Stack spacing={3}>
      <Box>
        <Chip label={status} color="primary" variant="outlined" size="small" />
        <Typography variant="h1" mt={1}>
          {title}
        </Typography>
        <Typography color="text.secondary">{description}</Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <TextField
          fullWidth
          size="small"
          placeholder={`Buscar en ${title.toLowerCase()}…`}
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
        <Button variant="contained" startIcon={<Add />}>
          Nuevo
        </Button>
      </Stack>
      <Card>
        <CardContent>
          <Typography variant="h2">Preparado para operar</Typography>
          <Typography color="text.secondary" mt={1}>
            La navegación, permisos, contratos de datos y reglas centrales están desacoplados.
            Conectá Google Workspace desde Configuración para reemplazar los datos locales.
          </Typography>
        </CardContent>
      </Card>
      <Alert severity="info">
        Esta pantalla preserva el recorrido del producto mientras su integración específica se
        habilita mediante feature flags.
      </Alert>
    </Stack>
  );
}
