import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { NotificationsCenter } from './NotificationsCenter';
import { DataContext, type DataClients } from '../../integrations/data';
import type { NotificationDto } from '../../integrations/data';
import { theme } from '../../app/theme';
import { AuthContextProvider } from '../../integrations/auth/AuthContext';
import { MockAuthProvider } from '../../integrations/auth/MockAuthProvider';
import { CurrentOrgProvider, OrgProvider } from '../../integrations/org';
import { BootstrapClient } from '../../integrations/org/bootstrapClient';
import type { GoogleUser } from '../../integrations/auth';

const fakeUser: GoogleUser = { sub: 'g-1', email: 'u@example.com', name: 'Test' };

const notif: NotificationDto = {
  id: 'n1',
  organizationId: 'org-1',
  kind: 'REQUEST_APPROVED',
  title: 'Solicitud aprobada',
  body: 'Sonido aprobado',
  link: '/requests/r1',
  entityType: 'Request',
  entityId: 'r1',
  read: false,
  createdAt: '2026-09-14T12:00:00.000Z',
  version: 1,
};

function makeFakeClients(
  overrides?: Partial<{
    list: NotificationDto[];
    markRead: ReturnType<typeof vi.fn>;
    markAll: ReturnType<typeof vi.fn>;
  }>,
): DataClients {
  const list = overrides?.list ?? [notif];
  const markRead = overrides?.markRead ?? vi.fn().mockResolvedValue(1);
  const markAll = overrides?.markAll ?? vi.fn().mockResolvedValue(list.length);
  return {
    catalog: {} as never,
    requests: {} as never,
    operations: {} as never,
    maintenance: {} as never,
    purchases: {} as never,
    notifications: {
      listMyNotifications: vi.fn().mockResolvedValue(list),
      markRead,
      markAllRead: markAll,
      unreadCount: vi.fn().mockResolvedValue(list.filter((n) => !n.read).length),
    } as never,
  };
}

function makeFakeOrgClient(): BootstrapClient {
  return {
    listMyOrganizations: vi.fn().mockResolvedValue({
      ok: true,
      organizations: [{ organizationId: 'org-1', name: 'Demo', isOwner: true }],
    }),
    bootstrapOrganization: vi.fn(),
  } as unknown as BootstrapClient;
}

function renderCenter(clients: DataClients) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth = new MockAuthProvider({ user: fakeUser, signInMode: 'auto' });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={qc}>
        <AuthContextProvider provider={auth}>
          <OrgProvider client={makeFakeOrgClient()}>
            <CurrentOrgProvider>
              <DataContext.Provider value={clients}>
                <MemoryRouter>
                  <NotificationsCenter open={true} anchorEl={document.body} onClose={vi.fn()} />
                </MemoryRouter>
              </DataContext.Provider>
            </CurrentOrgProvider>
          </OrgProvider>
        </AuthContextProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('NotificationsCenter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // CurrentOrgProvider reads from localStorage; jsdom doesn't always
    // expose it under the Vitest worker, so stub a no-op store.
    if (typeof window !== 'undefined' && !window.localStorage) {
      const store: Record<string, string> = {};
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: (k: string) => store[k] ?? null,
          setItem: (k: string, v: string) => {
            store[k] = v;
          },
          removeItem: (k: string) => {
            delete store[k];
          },
          clear: () => {
            Object.keys(store).forEach((k) => delete store[k]);
          },
          key: (i: number) => Object.keys(store)[i] ?? null,
          length: 0,
        },
        configurable: true,
      });
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the list of notifications once data arrives', async () => {
    renderCenter(makeFakeClients());
    await waitFor(() => {
      expect(screen.getByTestId('notification-row-n1')).toBeInTheDocument();
    });
    expect(screen.getByText('Solicitud aprobada')).toBeInTheDocument();
    expect(screen.getByText('Sonido aprobado')).toBeInTheDocument();
  });

  it('renders the empty state when there are no notifications', async () => {
    renderCenter(makeFakeClients({ list: [] }));
    await waitFor(() => {
      expect(screen.getByText('Sin notificaciones por ahora.')).toBeInTheDocument();
    });
  });

  it('marks a single notification as read when its action button is clicked', async () => {
    const markRead = vi.fn().mockResolvedValue(1);
    const clients = makeFakeClients({ markRead });
    renderCenter(clients);
    await waitFor(() => {
      expect(screen.getByTestId('notification-row-n1')).toBeInTheDocument();
    });
    const markBtn = screen.getByRole('button', { name: 'Marcar como leída' });
    fireEvent.click(markBtn);
    await waitFor(() => {
      expect(markRead).toHaveBeenCalledWith(['n1']);
    });
  });

  it('triggers markAllRead when the header action is pressed', async () => {
    const markAll = vi.fn().mockResolvedValue(1);
    const clients = makeFakeClients({ markAll });
    renderCenter(clients);
    await waitFor(() => {
      expect(screen.getByTestId('notification-row-n1')).toBeInTheDocument();
    });
    const all = screen.getByRole('button', { name: 'Marcar todo como leído' });
    fireEvent.click(all);
    await waitFor(() => {
      expect(markAll).toHaveBeenCalled();
    });
  });
});
