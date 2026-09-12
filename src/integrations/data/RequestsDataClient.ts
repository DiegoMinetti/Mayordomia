/**
 * RequestsDataClient — typed wrapper for the `requests.*` gateway actions.
 *
 * Mirrors the catalog pattern in `DataClient` and reuses the shared
 * `GatewayClient` so the same auth + org routing applies. The mock branches
 * are handled inside the GatewayClient (see `mockDispatch`); the test suite
 * injects a custom `fetch` to exercise the real path.
 */
import type { GatewayClient } from './GatewayClient';
import type {
  ApprovalScope,
  RequestDecisionPayload,
  RequestDto,
  RequestListFilters,
} from './types';

export interface RequestsDataClientOptions {
  organizationId: string;
}

export interface RequestDecisionResult {
  id: string;
  version: number;
  status: string;
}

export class RequestsDataClient {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly opts: RequestsDataClientOptions,
  ) {}

  async listRequests(filters: RequestListFilters = {}): Promise<RequestDto[]> {
    const payload: Record<string, unknown> = {};
    if (filters.status) payload['status'] = filters.status;
    if (filters.type) payload['type'] = filters.type;
    if (filters.siteId) payload['siteId'] = filters.siteId;
    if (filters.since) payload['since'] = filters.since;
    if (filters.until) payload['until'] = filters.until;
    const res = await this.gateway.call<{ requests: RequestDto[] }>(
      'requests.list',
      this.opts.organizationId,
      payload,
    );
    if (!res.ok) return [];
    return res.data.requests;
  }

  async getRequest(id: string): Promise<RequestDto | null> {
    const res = await this.gateway.call<{ request: RequestDto }>(
      'requests.get',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return null;
    return res.data.request;
  }

  async approveRequest(payload: RequestDecisionPayload): Promise<RequestDecisionResult | null> {
    return this.decide('requests.approve', payload);
  }

  async rejectRequest(payload: RequestDecisionPayload): Promise<RequestDecisionResult | null> {
    return this.decide('requests.reject', payload);
  }

  private async decide(
    action: 'requests.approve' | 'requests.reject',
    payload: RequestDecisionPayload,
  ): Promise<RequestDecisionResult | null> {
    const res = await this.gateway.call<{
      id: string;
      status: string;
      version: number;
    }>(action, this.opts.organizationId, { ...payload });
    if (!res.ok) return null;
    return { id: res.data.id, version: res.data.version, status: res.data.status };
  }
}

/** Helper for tests and ad-hoc checks: parses an `expectedVersion` defensively. */
export function buildDecisionPayload(
  id: string,
  scope: ApprovalScope,
  expectedVersion: number,
  comment?: string,
): RequestDecisionPayload {
  return comment ? { id, scope, expectedVersion, comment } : { id, scope, expectedVersion };
}
