import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  bootstrapFormSchema,
  DEFAULT_TIMEZONE,
  type BootstrapFormValues,
  type OrganizationDescriptor,
} from '../../domain/bootstrap';
import { useOrgClient, useInvalidateOrgList } from '../../integrations/org';
import { useAuth } from '../../integrations/auth';

const steps = ['Bienvenida', 'Cuenta Google', 'Organización', 'Primera sede', 'Listo'];

export function SetupPage() {
  const { isAuthenticated, user, isLoading: authLoading, signIn, error: authError } = useAuth();
  const orgClient = useOrgClient();
  const invalidateOrgList = useInvalidateOrgList();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [descriptor, setDescriptor] = useState<OrganizationDescriptor | null>(null);

  const form = useForm<BootstrapFormValues>({
    resolver: zodResolver(bootstrapFormSchema),
    defaultValues: {
      organizationName: '',
      timezone: DEFAULT_TIMEZONE,
      siteName: '',
      siteAddress: '',
      acceptTerms: true,
    },
    mode: 'onBlur',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await orgClient.bootstrapOrganization(values);
      if (!result.ok || !result.descriptor) {
        setSubmitError(result.error?.message ?? 'Error desconocido al crear la organización');
        return;
      }
      setDescriptor(result.descriptor);
      invalidateOrgList();
      setStep(steps.length - 1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Card>
        <CardContent>
          <Typography variant="h1">Configurar Mayordomía</Typography>
          <Typography color="text.secondary">
            Paso {Math.min(step + 1, steps.length)} de {steps.length}:{' '}
            {steps[Math.min(step, steps.length - 1)]}
          </Typography>
          <LinearProgress
            sx={{ my: 3 }}
            variant="determinate"
            value={(Math.min(step + 1, steps.length) / steps.length) * 100}
          />

          {step === 0 && (
            <Stack gap={2}>
              <Typography variant="h2">Organización para servir</Typography>
              <Typography>
                Este asistente crea la estructura de Drive, la base en Sheets y el primer
                administrador. Podés continuar más tarde: la ceremonia es de un solo uso por cuenta
                de Google.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vas a necesitar:
              </Typography>
              <Box component="ul" sx={{ pl: 3, m: 0 }}>
                <li>Una cuenta de Google (sos el primer administrador).</li>
                <li>Permitir que Mayordomía cree archivos en tu Drive.</li>
                <li>Elegir un nombre para la organización.</li>
              </Box>
            </Stack>
          )}

          {step === 1 && (
            <Stack gap={2}>
              <Typography variant="h2">Cuenta Google</Typography>
              {isAuthenticated && user ? (
                <Alert severity="success">
                  Sesión iniciada como <strong>{user.email}</strong>.
                </Alert>
              ) : (
                <>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => void signIn()}
                    disabled={authLoading || authError?.code === 'NOT_CONFIGURED'}
                  >
                    Continuar con Google
                  </Button>
                  {authError?.code === 'NOT_CONFIGURED' && (
                    <Alert severity="warning">
                      Configurá <code>VITE_GOOGLE_CLIENT_ID</code> en tu <code>.env.local</code>{' '}
                      para habilitar el login con Google.
                    </Alert>
                  )}
                </>
              )}
            </Stack>
          )}

          {(step === 2 || step === 3) && (
            <form onSubmit={onSubmit} noValidate>
              <Stack gap={2}>
                {step === 2 && (
                  <>
                    <TextField
                      label="Nombre de la organización"
                      required
                      fullWidth
                      {...form.register('organizationName')}
                      error={Boolean(form.formState.errors.organizationName)}
                      helperText={form.formState.errors.organizationName?.message}
                    />
                    <TextField
                      label="Zona horaria"
                      required
                      fullWidth
                      placeholder={DEFAULT_TIMEZONE}
                      {...form.register('timezone')}
                      error={Boolean(form.formState.errors.timezone)}
                      helperText={
                        form.formState.errors.timezone?.message ??
                        'Formato IANA, ej: America/Argentina/Buenos_Aires'
                      }
                    />
                  </>
                )}

                {step === 3 && (
                  <>
                    <TextField
                      label="Nombre de la primera sede (opcional)"
                      fullWidth
                      {...form.register('siteName')}
                      error={Boolean(form.formState.errors.siteName)}
                      helperText={form.formState.errors.siteName?.message}
                    />
                    <TextField
                      label="Dirección (opcional)"
                      fullWidth
                      {...form.register('siteAddress')}
                      error={Boolean(form.formState.errors.siteAddress)}
                      helperText={form.formState.errors.siteAddress?.message}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...form.register('acceptTerms')}
                          checked={Boolean(form.watch('acceptTerms'))}
                        />
                      }
                      label="Acepto que Mayordomía cree archivos en mi Drive de Google y registre auditoría."
                    />
                    {form.formState.errors.acceptTerms && (
                      <Alert severity="error">{form.formState.errors.acceptTerms.message}</Alert>
                    )}
                    {submitError && <Alert severity="error">{submitError}</Alert>}
                  </>
                )}
              </Stack>
            </form>
          )}

          {step === steps.length - 1 && descriptor && (
            <Stack gap={2}>
              <Alert severity="success">
                <strong>{descriptor.name}</strong> quedó configurada. Como primer usuario sos
                <strong> SUPER_ADMIN</strong>.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                ID de organización: <code>{descriptor.organizationId}</code>
              </Typography>
              {descriptor.site && (
                <Typography variant="body2" color="text.secondary">
                  Sede inicial: <strong>{descriptor.site.name}</strong>
                </Typography>
              )}
            </Stack>
          )}

          <Box mt={3} display="flex" justifyContent="space-between" gap={1}>
            <Button
              disabled={step === 0 || step === steps.length - 1 || submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Atrás
            </Button>
            {step === 0 && (
              <Button variant="contained" onClick={() => setStep(1)}>
                Empezar
              </Button>
            )}
            {step === 1 && (
              <Button variant="contained" onClick={() => setStep(2)} disabled={!isAuthenticated}>
                Continuar
              </Button>
            )}
            {step === 2 && (
              <Button
                variant="contained"
                onClick={() => setStep(3)}
                disabled={
                  !form.watch('organizationName') ||
                  Boolean(form.formState.errors.organizationName) ||
                  Boolean(form.formState.errors.timezone)
                }
              >
                Continuar
              </Button>
            )}
            {step === 3 && (
              <Button
                variant="contained"
                onClick={onSubmit}
                disabled={submitting || !form.watch('acceptTerms')}
              >
                {submitting ? 'Creando…' : 'Crear organización'}
              </Button>
            )}
            {step === steps.length - 1 && (
              <Button component={Link} to="/" variant="contained">
                Ir al inicio
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
