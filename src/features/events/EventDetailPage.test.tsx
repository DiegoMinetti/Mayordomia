import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EventDetailPage } from './EventDetailPage';
import { DataClient } from '../../integrations/data/DataClient';
import { DataContext } from '../../integrations/data/DataContext';
import type { EventDetailDto, GatewayResponse } from '../../integrations/data';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
}

function envelopeOk<T>(data: T): GatewayResponse<T> {
  return { ok: true, data };
}

const SAMPLE: EventDetailDto = {
  id: 'evt-1',
  organizationId: 'org-1',
  siteId: 'site-1',
  name: 'Culto principal',
  description: 'Servicio dominical.',
  kind: 'SERVICE',
  startAt: '2026-09-14T22:00:00Z',
  endAt: '2026-09-14T23:30:00Z',
  allDay: false,
  status: 'PUBLISHED',
  createdAt: '2026-09-01T00:00:00Z',
  createdBy: 'u1',
  updatedAt: '2026-09-01T00:00:00Z',
  updatedBy: 'u1',
  version: 1,
  areas: [
    {
      id: 'a1',
      organizationId: 'org-1',
      eventId: 'evt-1',
      areaId: 'area-alabanza',
      responsibility: 'LEAD',
    },
  ],
  resources: [
    { id: 'r1', organizationId: 'org-1', eventId: 'evt-1', resourceId: 'res-sonido', quantity: 1 },
  ],
  people: [
    { id: 'p1', organizationId: 'org-1', eventId: 'evt-1', personId: 'p-dir1', role: 'LEAD' },
  ],
  template: {
    id: 'tpl-1',
    organizationId: 'org-1',
    name: 'Plantilla Culto',
    description: 'Esqueleto estándar.',
    durationMinutes: 90,
  },
};

function buildFakeClient(
  handler: (action: string, payload: unknown) => GatewayResponse<unknown>,
): DataClient {
  const gw = {
    call: vi
      .fn()
      .mockImplementation(async (action: string, _org: string, payload: Record<string, unknown>) =>
        handler(action, payload),
      ),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new DataClient(gw as any, { organizationId: 'org-1' });
}

function TestProvider({ client, children }: { client: DataClient; children: ReactNode }) {
  return (
    <DataContext.Provider
      value={{
        catalog: client,
        requests: {} as never,
        operations: {} as never,
        maintenance: {} as never,
        purchases: {} as never,
        notifications: {} as never,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

function renderWith(client: DataClient, route: string) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <TestProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetailPage />} />
          </Routes>
        </MemoryRouter>
      </TestProvider>
    </QueryClientProvider>,
  );
}

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the event name, status and areas', async () => {
    const client = buildFakeClient((action) => {
      if (action === 'events.get') return envelopeOk({ event: SAMPLE });
      if (action === 'catalog.listSites') return envelopeOk({ sites: [] });
      return envelopeOk({ events: [SAMPLE] });
    });
    renderWith(client, '/events/evt-1');
    await waitFor(() => expect(screen.getByText('Culto principal')).toBeInTheDocument());
    expect(screen.getByText('Publicado')).toBeInTheDocument();
    expect(screen.getByText('area-alabanza · Lidera')).toBeInTheDocument();
    expect(screen.getByText('Basado en plantilla')).toBeInTheDocument();
  });

  it('shows a not-found alert when the gateway returns an error', async () => {
    const client = buildFakeClient(() => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'no' },
    }));
    renderWith(client, '/events/missing');
    await waitFor(() =>
      expect(screen.getByText('No se encontró el evento solicitado.')).toBeInTheDocument(),
    );
  });
});
