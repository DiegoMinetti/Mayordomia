import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { theme } from './app/theme';
import { AuthContextProvider, GoogleIdentityAuthProvider } from './integrations/auth';
import './app/global.css';

registerSW({ immediate: true });
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const authProvider = new GoogleIdentityAuthProvider({ clientId: googleClientId });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthContextProvider provider={authProvider}>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <App />
          </BrowserRouter>
        </AuthContextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
