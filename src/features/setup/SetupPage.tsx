import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';

const steps = ['Bienvenida', 'Cuenta Google', 'Organización', 'Primera sede'];
export function SetupPage() {
  const [step, setStep] = useState(0);
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Card>
        <CardContent>
          <Typography variant="h1">Configurar Mayordomía</Typography>
          <Typography color="text.secondary">
            Paso {step + 1} de {steps.length}: {steps[step]}
          </Typography>
          <LinearProgress
            sx={{ my: 3 }}
            variant="determinate"
            value={((step + 1) / steps.length) * 100}
          />
          <Stack gap={2}>
            {step === 0 && (
              <>
                <Typography variant="h2">Organización para servir</Typography>
                <Typography>
                  Este asistente crea la estructura de Drive, la base en Sheets y el primer
                  administrador. Podés continuar más tarde.
                </Typography>
              </>
            )}
            {step === 1 && (
              <>
                <Button variant="contained" size="large">
                  Continuar con Google
                </Button>
                <Alert severity="info">
                  En desarrollo local se usa un adaptador de demostración. Configurá
                  VITE_GOOGLE_CLIENT_ID para OAuth real.
                </Alert>
              </>
            )}
            {step === 2 && (
              <>
                <TextField label="Nombre de la organización" defaultValue="Congregación Central" />
                <TextField label="Zona horaria" defaultValue="America/Argentina/Buenos_Aires" />
              </>
            )}
            {step === 3 && (
              <>
                <TextField label="Nombre de la sede" defaultValue="Sede Centro" />
                <TextField label="Dirección" />
                <Alert severity="success">
                  La configuración queda lista para crear áreas y calendarios.
                </Alert>
              </>
            )}
          </Stack>
          <Box mt={3} display="flex" justifyContent="space-between">
            <Button disabled={!step} onClick={() => setStep(step - 1)}>
              Atrás
            </Button>
            {step < steps.length - 1 ? (
              <Button variant="contained" onClick={() => setStep(step + 1)}>
                Continuar
              </Button>
            ) : (
              <Button component={Link} to="/" variant="contained">
                Finalizar
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
