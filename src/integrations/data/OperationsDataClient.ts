/**
 * OperationsDataClient — typed wrapper for the `operations.*` gateway actions.
 *
 * Mirrors `RequestsDataClient`: same auth + org routing, the mock branch
 * is handled inside `GatewayClient.mockDispatch`.
 */
import type { GatewayClient } from './GatewayClient';
import type {
  DeliveryDto,
  DeliveryItemDto,
  DeliveryListFilters,
  DeliverPayload,
  ReturnDeliveryItemPayload,
} from './types';
import { deliveryProgress, deriveDeliveryStatus } from '../../domain/operations';

export interface OperationsDataClientOptions {
  organizationId: string;
}

export interface DeliveryWithItems {
  delivery: DeliveryDto;
  items: DeliveryItemDto[];
  progress: ReturnType<typeof deliveryProgress>;
  /** Joined request header (when the gateway provides it). */
  request?: {
    id: string;
    type: string;
    requesterName: string;
    description: string;
    eventStart?: string;
    eventEnd?: string;
    siteId?: string;
  };
  /** Resolved resource metadata for each item. */
  resources?: Record<string, { id: string; name: string; status: string }>;
}

export interface DeliverResult {
  delivery: DeliveryDto;
  items: DeliveryItemDto[];
  /** Resource statuses that were updated, for cache invalidation. */
  resourceIds: string[];
}

export interface ReturnDeliveryItemResult {
  item: DeliveryItemDto;
  resourceId: string;
  newStatus: string;
  maintenanceId?: string;
}

export class OperationsDataClient {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly opts: OperationsDataClientOptions,
  ) {}

  async listDeliveries(filters: DeliveryListFilters = {}): Promise<DeliveryDto[]> {
    const payload: Record<string, unknown> = {};
    if (filters.requestId) payload['requestId'] = filters.requestId;
    if (filters.status) payload['status'] = filters.status;
    if (filters.since) payload['since'] = filters.since;
    if (filters.until) payload['until'] = filters.until;
    const res = await this.gateway.call<{ deliveries: DeliveryDto[] }>(
      'operations.listDeliveries',
      this.opts.organizationId,
      payload,
    );
    if (!res.ok) return [];
    return res.data.deliveries;
  }

  async getDelivery(id: string): Promise<DeliveryWithItems | null> {
    const res = await this.gateway.call<DeliveryWithItems>(
      'operations.getDelivery',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return null;
    return res.data;
  }

  async deliver(payload: DeliverPayload): Promise<DeliverResult | null> {
    const res = await this.gateway.call<DeliverResult>(
      'operations.deliver',
      this.opts.organizationId,
      { ...payload },
    );
    if (!res.ok) return null;
    return res.data;
  }

  async returnDeliveryItem(
    payload: ReturnDeliveryItemPayload,
  ): Promise<ReturnDeliveryItemResult | null> {
    const res = await this.gateway.call<ReturnDeliveryItemResult>(
      'operations.returnDeliveryItem',
      this.opts.organizationId,
      { ...payload },
    );
    if (!res.ok) return null;
    return res.data;
  }
}

export { deliveryProgress, deriveDeliveryStatus };
