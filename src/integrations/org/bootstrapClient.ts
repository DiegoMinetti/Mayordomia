/**
 * Bootstrap + discovery client for the Apps Script gateway.
 *
 * This client is the only path the frontend uses to talk to `bootstrap.organization`
 * and `org.listMine`. It requires a valid access token from the auth provider.
 *
 * The client never reads the URL directly; the gateway URL comes from
 * `VITE_APPS_SCRIPT_URL`. When that env var is missing (dev without deploy), the
 * client returns a structured error so the UI can show a clear message instead
 * of crashing.
 */

import type {
  BootstrapResult,
  BootstrapFormValues,
  ListMineResult,
  OrganizationDescriptor,
  OrganizationSummary,
} from '../../domain/bootstrap';

export interface BootstrapClientDeps {
  appsScriptUrl: string;
  getAccessToken: () => Promise<string>;
  /** When true, the client returns deterministic mock data without hitting the gateway. */
  mock?: boolean;
}

export class BootstrapClient {
  constructor(private readonly deps: BootstrapClientDeps) {}

  async bootstrapOrganization(form: BootstrapFormValues): Promise<BootstrapResult> {
    if (this.deps.mock) {
      return mockBootstrapResult(form);
    }
    return this.call<BootstrapResult>('bootstrap.organization', {
      organizationName: form.organizationName,
      timezone: form.timezone,
      siteName: form.siteName || undefined,
      siteAddress: form.siteAddress || undefined,
    });
  }

  async listMyOrganizations(): Promise<ListMineResult> {
    if (this.deps.mock) {
      return mockListMineResult();
    }
    return this.call<ListMineResult>('org.listMine', {});
  }

  private async call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    if (!this.deps.appsScriptUrl) {
      return {
        ok: false,
        error: {
          code: 'NOT_CONFIGURED',
          message:
            'VITE_APPS_SCRIPT_URL no está configurada. Hacé deploy del gateway con `npm run deploy:script`.',
        },
      } as T;
    }
    let accessToken: string;
    try {
      accessToken = await this.deps.getAccessToken();
    } catch {
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'No hay sesión válida. Iniciá sesión.' },
      } as T;
    }
    const res = await fetch(this.deps.appsScriptUrl, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, auth: { accessToken }, payload }),
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        ok: false,
        error: { code: 'NETWORK', message: 'Respuesta no es JSON válido' },
      } as T;
    }
    const env = body as { ok?: boolean; data?: unknown; error?: { code: string; message: string } };
    if (!env.ok) {
      return {
        ok: false,
        error: env.error || { code: 'UNKNOWN', message: 'Error desconocido del gateway' },
      } as T;
    }
    return { ok: true, ...((env.data as object) ?? {}) } as T;
  }
}

let mockCounter = 0;
function mockBootstrapResult(form: BootstrapFormValues): BootstrapResult {
  mockCounter += 1;
  const id = `org-mock-${mockCounter.toString().padStart(4, '0')}`;
  const descriptor: OrganizationDescriptor = {
    organizationId: id,
    name: form.organizationName,
    rootFolderId: `mock-folder-${id}`,
    databaseFileId: `mock-db-${id}`,
    schemaVersion: 1,
    ownerEmail: 'mock@example.com',
    isFirstUser: true,
    site: form.siteName
      ? { id: `site-mock-${mockCounter}`, organizationId: id, name: form.siteName }
      : null,
  };
  return { ok: true, descriptor };
}

function mockListMineResult(): ListMineResult {
  const organizations: OrganizationSummary[] = [
    {
      organizationId: 'org-mock-0001',
      name: 'Congregación Demo',
      rootFolderId: 'mock-folder-1',
      databaseFileId: 'mock-db-1',
      schemaVersion: 1,
      isOwner: true,
    },
  ];
  return { ok: true, organizations };
}
