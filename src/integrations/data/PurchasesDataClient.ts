/**
 * PurchasesDataClient — typed wrapper for the `purchases.*` gateway actions.
 *
 * Mirrors the catalog/requests patterns. The mock branch lives inside
 * `GatewayClient.mockDispatch`; the test suite uses an injected `fetch`
 * to exercise the real path.
 */
import type { GatewayClient } from './GatewayClient';
import type {
  AddQuoteInput,
  CreatePurchaseRequestInput,
  DecidePurchaseInput,
  DecidePurchaseResult,
  PurchaseRequestDetailDto,
  PurchaseRequestDto,
  PurchaseRequestFilters,
  QuoteDto,
  SupplierDto,
  UpsertSupplierInput,
} from './types';

export interface PurchasesDataClientOptions {
  organizationId: string;
}

export class PurchasesDataClient {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly opts: PurchasesDataClientOptions,
  ) {}

  async listRequests(filters: PurchaseRequestFilters = {}): Promise<PurchaseRequestDto[]> {
    const payload: Record<string, unknown> = {};
    if (filters.status) payload['status'] = filters.status;
    if (filters.requesterId) payload['requesterId'] = filters.requesterId;
    if (filters.since) payload['since'] = filters.since;
    if (filters.until) payload['until'] = filters.until;
    const res = await this.gateway.call<{ requests: PurchaseRequestDto[] }>(
      'purchases.listRequests',
      this.opts.organizationId,
      payload,
    );
    if (!res.ok) return [];
    return res.data.requests;
  }

  async getRequest(id: string): Promise<PurchaseRequestDetailDto | null> {
    const res = await this.gateway.call<PurchaseRequestDetailDto>(
      'purchases.getRequest',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return null;
    return res.data;
  }

  async createRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequestDetailDto | null> {
    const res = await this.gateway.call<PurchaseRequestDetailDto>(
      'purchases.createRequest',
      this.opts.organizationId,
      { ...input },
    );
    if (!res.ok) return null;
    return res.data;
  }

  async listQuotes(purchaseRequestId: string): Promise<QuoteDto[]> {
    const res = await this.gateway.call<{ quotes: QuoteDto[] }>(
      'purchases.listQuotes',
      this.opts.organizationId,
      { purchaseRequestId },
    );
    if (!res.ok) return [];
    return res.data.quotes;
  }

  async addQuote(input: AddQuoteInput): Promise<QuoteDto | null> {
    const res = await this.gateway.call<{ quote: QuoteDto }>(
      'purchases.addQuote',
      this.opts.organizationId,
      { ...input },
    );
    if (!res.ok) return null;
    return res.data.quote;
  }

  async decide(input: DecidePurchaseInput): Promise<DecidePurchaseResult | null> {
    const res = await this.gateway.call<DecidePurchaseResult>(
      'purchases.decide',
      this.opts.organizationId,
      { ...input },
    );
    if (!res.ok) return null;
    return res.data;
  }

  async listSuppliers(): Promise<SupplierDto[]> {
    const res = await this.gateway.call<{ suppliers: SupplierDto[] }>(
      'purchases.listSuppliers',
      this.opts.organizationId,
      {},
    );
    if (!res.ok) return [];
    return res.data.suppliers;
  }

  async upsertSupplier(input: UpsertSupplierInput): Promise<SupplierDto | null> {
    const res = await this.gateway.call<{ supplier: SupplierDto }>(
      'purchases.upsertSupplier',
      this.opts.organizationId,
      { ...input },
    );
    if (!res.ok) return null;
    return res.data.supplier;
  }
}
