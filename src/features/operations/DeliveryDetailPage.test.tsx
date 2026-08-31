import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { DeliveryDetailPage } from './DeliveryDetailPage';
import { DataContext } from '../../integrations/data/DataContext';
import { theme } from '../../app/theme';
import type { DeliveryWithItems, ReturnDeliveryItemResult } from '../../integrations/data';
import type { DataClients } from '../../integrations/data/DataContext';

const MOCK_DELIVERY: DeliveryWithItems = {
  delivery: {
    id: 'd-1',
    organizationId: 'org-1',
    requestId: 'r-1',
    deliveredBy: 'u-1',
    deliveredAt: '2026-08-30T10:00:00Z',
    recipientName: 'Ana Suárez',
    status: 'IN_PROGRESS',
    createdAt: '2026-08-30T09:55:00Z',
    createdBy: 'u-1',
    updatedBy: 'u-1',
    version: 1,
  },
  items: [
    {
      id: 'it-1',
      organizationId: 'org-1',
      deliveryId: 'd-1',
      resourceId: 'res-1',
      quantity: 1,
      version: 1,
    },
  ],
  progress: { totalItems: 1, returnedItems: 0, openItems: 1, damageCount: 0 },
  request: {
    id: 'r-1',
    type: 'RESOURCE',
    requesterName: 'Ana Suárez',
    description: 'Solicitud demo',
  },
  resources: { 'res-1': { id: 'res-1', name: 'Proyector Epson', status: 'IN_USE' } },
};

function makeFakeClients(overrides?: {
  getDelivery?: ReturnType<typeof vi.fn>;
  returnDeliveryItem?: ReturnType<typeof vi.fn>;
}) {
  const getDelivery = overrides?.getDelivery ?? vi.fn().mockResolvedValue(MOCK_DELIVERY);
  const returnDeliveryItem =
    overrides?.returnDeliveryItem ??
    vi.fn().mockImplementation(async (): Promise<ReturnDeliveryItemResult> => ({
      item: {
        ...MOCK_DELIVERY.items[0],
        returnedAt: new Date().toISOString(),
        condition: 'OK',
        version: 2,
      },
      resourceId: 'res-1',
      newStatus: 'AVAILABLE',
    }));
  return {
    catalog: {} as never,
    requests: {} as never,
    operations: {
      getDelivery,
      returnDeliveryItem,
    } as unknown as DataClients['operations'],
    maintenance: {} as never,
    purchases: {} as never,
    notifications: {} as never,
  } satisfies DataClients;
}

function renderPage(clients: DataClients) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={qc}>
        <DataContext.Provider value={clients}>
          <MemoryRouter initialEntries={['/operations/d-1']}>
            <Routes>
              <Route path="/operations/:id" element={<DeliveryDetailPage />} />
            </Routes>
          </MemoryRouter>
        </DataContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('DeliveryDetailPage', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('renders the delivery and its open items', async () => {
    renderPage(makeFakeClients());
    await waitFor(() => expect(screen.getByText('Proyector Epson')).toBeInTheDocument());
    expect(screen.getAllByText('Ana Suárez').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 pendiente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /devolver/i })).toBeInTheDocument();
  });

  it('opens the return dialog and calls the mutation on submit', async () => {
    const returnDeliveryItem = vi.fn().mockResolvedValue({
      item: {
        ...MOCK_DELIVERY.items[0],
        returnedAt: '2026-08-30T12:00:00Z',
        condition: 'OK',
        version: 2,
      },
      resourceId: 'res-1',
      newStatus: 'AVAILABLE',
    } satisfies ReturnDeliveryItemResult);
    renderPage(makeFakeClients({ returnDeliveryItem }));

    await waitFor(() => expect(screen.getByText('Proyector Epson')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /devolver/i }));

    await waitFor(() => expect(screen.getByText('Devolver item')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirmar devoluci/i }));

    await waitFor(() => expect(returnDeliveryItem).toHaveBeenCalled());
    const args = returnDeliveryItem.mock.calls[0][0] as Record<string, unknown>;
    expect(args.condition).toBe('OK');
    expect(args.deliveryItemId).toBe('it-1');
  });
});
