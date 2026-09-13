/**
 * LoginDialog — modal login form for the LocalAuthProvider.
 *
 * Collects email + password + organizationId, calls the provider's signIn().
 * Also offers a "Create account" link that flips to the registration form
 * (same fields + a name) for first-run / setup flows.
 */
import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Stack,
} from '@mui/material';
import { useAuth } from '../../integrations/auth';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the dialog pre-fills the organization id (first-run flow). */
  defaultOrganizationId?: string;
}

export function LoginDialog({ open, onClose, defaultOrganizationId }: LoginDialogProps) {
  const { signIn, signUp, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState(defaultOrganizationId ?? '');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') {
        await signIn({ email, password, organizationId });
      } else {
        if (!signUp) {
          setError('Registro no soportado en este provider');
          return;
        }
        await signUp({ email, password, organizationId, name });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const loading = submitting || isLoading;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</DialogTitle>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <DialogContent>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              required
              fullWidth
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <TextField
              label="Contraseña"
              type="password"
              required
              fullWidth
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              inputProps={{ minLength: 8 }}
            />
            <TextField
              label="ID de organización"
              required
              fullWidth
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              disabled={loading}
              helperText="6-128 caracteres, letras/números/guiones"
            />
            {mode === 'register' && (
              <TextField
                label="Nombre"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', p: 2, gap: 1 }}>
          <Button type="submit" variant="contained" disabled={loading}>
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </Button>
          <Button
            type="button"
            size="small"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            disabled={loading}
          >
            {mode === 'login' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
