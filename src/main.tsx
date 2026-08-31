import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { theme } from './app/theme';
import { AuthContextProvider, GoogleIdentityAuthProvider } from './integrations/auth';
import {
  createBootstrapClient,
  CurrentOrgProvider,
  OrgProvider,
  useCurrentOrg,
} from './integrations/org';
import { DataProvider } from './integrations/data';
import './app/global.css';

registerSW({ immediate: true });
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL ?? '';
const useMockPublic = import.meta.env.VITE_USE_MOCK_PUBLIC === 'true';

const authProvider = new GoogleIdentityAuthProvider({ clientId: googleClientId });
const bootstrapClient = createBootstrapClient({
  appsScriptUrl,
  getAccessToken: () => authProvider.getValidAccessToken(),
  mock: useMockPublic || !appsScriptUrl,
});

const gatewayDeps = {
  appsScriptUrl,
  getAccessToken: () => authProvider.getValidAccessToken(),
  mock: useMockPublic || !appsScriptUrl,
};

function InnerProviders({ children }: { children: React.ReactNode }) {
  const { organizationId, ready } = useCurrentOrg();
  if (!ready || !organizationId) {
    // While discovery is loading or the user has no org yet, render the app
    // without a DataProvider. Modules that need data will show their own
    // empty state.
    return <>{children}</>;
  }
  return (
    <DataProvider deps={gatewayDeps} organizationId={organizationId}>
      {children}
    </DataProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthContextProvider provider={authProvider}>
          <OrgProvider client={bootstrapClient}>
            <CurrentOrgProvider>
              <InnerProviders>
                <BrowserRouter basename={import.meta.env.BASE_URL}>
                  <App />
                </BrowserRouter>
              </InnerProviders>
            </CurrentOrgProvider>
          </OrgProvider>
        </AuthContextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
