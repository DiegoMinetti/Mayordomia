import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { ResourcesPage } from './ResourcesPage';
import { DataContext, type DataClient } from '../../integrations/data';
import { theme } from '../../app/theme';
import type { ResourceDto, SiteDto } from '../../integrations/data/types';

function makeFakeClient(): DataClient {
  const resources: ResourceDto[] = [
    {
      id: 'r-serial',
      organizationId: 'org-1',
      siteId: 'site-1',
      name: 'Proyector Epson',
      inventoryType: 'SERIALIZED',
      status: 'AVAILABLE',
      quantity: 1,
      unit: 'unidad',
      internalCode: 'PROY-001',
      version: 1,
    },
    {
      id: 'r-qty',
      organizationId: 'org-1',
      siteId: 'site-1',
      name: 'Sillas plegables',
      inventoryType: 'QUANTITY',
      status: 'AVAILABLE',
      quantity: 30,
      unit: 'unidad',
      version: 1,
    },
  ];
  const sites: SiteDto[] = [
    {
      id: 'site-1',
      organizationId: 'org-1',
      name: 'Sede Centro',
      address: '',
      active: true,
      version: 1,
    },
  ];
  return {
    listResources: vi.fn().mockResolvedValue(resources),
    listSites: vi.fn().mockResolvedValue(sites),
    listReservations: vi.fn().mockResolvedValue([]),
    listMovements: vi.fn().mockResolvedValue([]),
    listLocations: vi.fn().mockResolvedValue([]),
    getResource: vi.fn(),
    getLocation: vi.fn(),
    getOrganization: vi.fn(),
    listOrganizations: vi.fn(),
    listUsers: vi.fn(),
    listRoles: vi.fn(),
    checkAvailability: vi
      .fn()
      .mockResolvedValue({ available: { resource: {}, location: {} }, conflicts: [] }),
    getResourceWithMovements: vi.fn(),
  } as unknown as DataClient;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={qc}>
        <DataContext.Provider value={makeFakeClient()}>
          <MemoryRouter>
            <ResourcesPage />
          </MemoryRouter>
        </DataContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('ResourcesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('groups resources by inventory type once data arrives', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Proyector Epson')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 2, name: 'Serializados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Por cantidad' })).toBeInTheDocument();
    expect(screen.getByText('Sillas plegables')).toBeInTheDocument();
  });

  it('shows the empty state when there are no results', async () => {
    // Override the listResources to return an empty list.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const emptyClient = {
      ...makeFakeClient(),
      listResources: vi.fn().mockResolvedValue([]),
    } as unknown as DataClient;
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={qc}>
          <DataContext.Provider value={emptyClient}>
            <MemoryRouter>
              <ResourcesPage />
            </MemoryRouter>
          </DataContext.Provider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('Sin resultados')).toBeInTheDocument());
  });
});
