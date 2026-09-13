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
  Tabs,
  Tab,
} from '@mui/material';
import { startAuthentication as startPasskey } from '@simplewebauthn/browser';
import { ApiCallError, useAuth } from '../../integrations/auth';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the dialog pre-fills the organization id (first-run flow). */
  defaultOrganizationId?: string;
}

type Mode = 'password' | 'magic-link' | 'passkey';

export function LoginDialog({ open, onClose, defaultOrganizationId }: LoginDialogProps) {
  const { signIn, signUp, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<Mode>('password');
  const [passwordMode, setPasswordMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState(defaultOrganizationId ?? '');
  const [name, setName] = useState('');
  const [magicToken, setMagicToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  // When register fails with ORG_NOT_FOUND we offer an in-dialog bootstrap that
  // calls /api/auth/setup with the same email/password/orgId so the user doesn't
  // have to leave the UI and curl by hand.
  const [bootstrapPrompt, setBootstrapPrompt] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setBootstrapPrompt(false);
    try {
      if (authMode === 'password') {
        if (passwordMode === 'login') {
          await signIn({ email, password, organizationId });
        } else {
          if (!signUp) {
            setError('Registro no soportado en este provider');
            return;
          }
          await signUp({ email, password, organizationId, name });
        }
        onClose();
      } else {
        if (magicToken) {
          const res = await fetch('/api/auth/magic-link/verify', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: magicToken }),
          });
          const body = (await res.json()) as { ok: boolean; error?: { message: string } };
          if (!body.ok) throw new Error(body.error?.message ?? 'verify failed');
          window.location.reload();
        } else {
          const res = await fetch('/api/auth/magic-link', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, organizationId }),
          });
          const body = (await res.json()) as {
            ok: boolean;
            data?: { devLink?: string };
            error?: { message: string };
          };
          if (!body.ok) throw new Error(body.error?.message ?? 'request failed');
          setMagicSent(true);
          if (body.data?.devLink) setDevLink(body.data.devLink);
        }
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      if (err instanceof ApiCallError && err.code === 'ORG_NOT_FOUND') {
        setBootstrapPrompt(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBootstrap(): Promise<void> {
    setBootstrapping(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: name || email.split('@')[0],
          organizationId,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { token?: string };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? 'setup failed');
      // /auth/setup already set the cookie. Reload so the rest of the app picks
      // up the new session via /auth/me.
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBootstrapping(false);
    }
  }

  const loading = submitting || isLoading;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Iniciar sesión</DialogTitle>
      <Tabs
        value={authMode}
        onChange={(_: unknown, v: Mode) => {
          setAuthMode(v);
          setError(null);
          setMagicSent(false);
          setDevLink(null);
          setBootstrapPrompt(false);
        }}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
      >
        <Tab value="password" label="Contraseña" />
        <Tab value="magic-link" label="Magic link" />
        <Tab value="passkey" label="Passkey" />
      </Tabs>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <DialogContent>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {authMode === 'password' && passwordMode === 'register' && (
              <Alert severity="info">
                Vas a crear la primera cuenta de esta organización. La contraseña debe tener al
                menos 8 caracteres.
              </Alert>
            )}
            {authMode === 'magic-link' && magicSent && (
              <Alert severity="success">
                Si el email existe, enviamos un enlace. Revisá tu casilla.
                {devLink && (
                  <>
                    {' '}
                    <br />
                    Dev mode: <a href={devLink}>{devLink}</a>
                  </>
                )}
              </Alert>
            )}
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
            {authMode === 'password' && (
              <TextField
                label="Contraseña"
                type="password"
                required
                fullWidth
                autoComplete={passwordMode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                inputProps={{ minLength: 8 }}
              />
            )}
            <TextField
              label="ID de organización"
              required
              fullWidth
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              disabled={loading}
              helperText="6-128 caracteres, letras/números/guiones"
            />
            {authMode === 'password' && passwordMode === 'register' && (
              <TextField
                label="Nombre"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            )}
            {authMode === 'magic-link' && magicSent && (
              <TextField
                label="Token de magic link (pegá el enlace)"
                fullWidth
                value={magicToken}
                onChange={(e) => setMagicToken(e.target.value)}
                disabled={loading}
                helperText="Pegá el token del enlace que recibiste por email."
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', p: 2, gap: 1 }}>
          <Button type="submit" variant="contained" disabled={loading}>
            {authMode === 'passkey'
              ? 'Iniciar con passkey'
              : authMode === 'magic-link' && magicSent
                ? 'Verificar enlace'
                : authMode === 'password'
                  ? passwordMode === 'login'
                    ? 'Iniciar sesión'
                    : 'Crear cuenta'
                  : 'Enviar enlace'}
          </Button>
          {bootstrapPrompt && (
            <Button
              type="button"
              variant="outlined"
              color="primary"
              onClick={() => void handleBootstrap()}
              disabled={loading || bootstrapping}
            >
              {bootstrapping ? 'Creando congregación…' : 'Crear congregación y cuenta'}
            </Button>
          )}
          {authMode === 'password' && (
            <Button
              type="button"
              size="small"
              onClick={() => {
                setPasswordMode(passwordMode === 'login' ? 'register' : 'login');
                setError(null);
                setBootstrapPrompt(false);
              }}
              disabled={loading}
            >
              {passwordMode === 'login' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
