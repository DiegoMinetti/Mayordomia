/**
 * Purchases read endpoints. PR 4 covers list/get only.
 * Mutations (createRequest, addQuote, decide) come in PR 5.
 */
import { ApiError } from '../errors.js';
import { enumValue, id as validateId, object } from '../validation.js';
import type { SheetsClient } from '../sheets/client.js';
import type { DispatchContext } from '../router/index.js';

const REQUEST_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'] as const;

export interface PurchasesHandlersDeps {
  sheets: SheetsClient;
}

function toSupplier(r: Record<string, unknown>) {
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    name: String(r['name'] ?? ''),
    contactName: r['contactName'] ? String(r['contactName']) : undefined,
    email: r['email'] ? String(r['email']) : undefined,
    phone: r['phone'] ? String(r['phone']) : undefined,
    notes: r['notes'] ? String(r['notes']) : undefined,
    rating: typeof r['rating'] === 'number' ? r['rating'] : undefined,
    active: r['active'] === true || r['active'] === 'TRUE' || r['active'] === 'true',
    createdAt: r['createdAt'] ? String(r['createdAt']) : undefined,
    updatedAt: r['updatedAt'] ? String(r['updatedAt']) : undefined,
    version: Number(r['version'] ?? 1),
  };
}

function toItem(r: Record<string, unknown>) {
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    purchaseRequestId: String(r['purchaseRequestId'] ?? ''),
    name: String(r['name'] ?? ''),
    description: r['description'] ? String(r['description']) : undefined,
    quantity: Number(r['quantity'] ?? 0),
    unit: String(r['unit'] ?? 'unidad'),
    estimatedCost: typeof r['estimatedCost'] === 'number' ? r['estimatedCost'] : undefined,
    version: Number(r['version'] ?? 1),
  };
}

function toQuote(r: Record<string, unknown>, supplierName: string) {
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    purchaseRequestId: String(r['purchaseRequestId'] ?? ''),
    supplierId: String(r['supplierId'] ?? ''),
    supplierName,
    price: Number(r['price'] ?? 0),
    currency: String(r['currency'] ?? 'ARS'),
    qualityScore: Number(r['qualityScore'] ?? 0),
    deliveryDays: Number(r['deliveryDays'] ?? 0),
    warrantyMonths: Number(r['warrantyMonths'] ?? 0),
    technicalFitScore: Number(r['technicalFitScore'] ?? 0),
    notes: r['notes'] ? String(r['notes']) : undefined,
    status: String(r['status'] ?? 'PENDING'),
    submittedAt: r['submittedAt'] ? String(r['submittedAt']) : undefined,
    version: Number(r['version'] ?? 1),
  };
}

function toRequestListItem(r: Record<string, unknown>, items: Array<Record<string, unknown>>, quoteCount: number) {
  const totalEstimated = items.reduce((acc, it) => acc + (Number(it['estimatedCost']) || 0) * (Number(it['quantity']) || 0), 0);
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    siteId: r['siteId'] ? String(r['siteId']) : undefined,
    needId: r['needId'] ? String(r['needId']) : undefined,
    title: String(r['title'] ?? ''),
    description: r['description'] ? String(r['description']) : undefined,
    status: String(r['status'] ?? 'DRAFT'),
    requesterId: r['requesterId'] ? String(r['requesterId']) : undefined,
    createdAt: String(r['createdAt'] ?? ''),
    updatedAt: r['updatedAt'] ? String(r['updatedAt']) : undefined,
    version: Number(r['version'] ?? 1),
    itemCount: items.length,
    quoteCount,
    estimatedTotal: totalEstimated,
  };
}

export function makePurchasesHandlers(deps: PurchasesHandlersDeps) {
  async function listSuppliers(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const orgId = ctx.auth!.organizationId;
    const active = payload['active'] === undefined ? null : payload['active'] === true;
    let rows = (await deps.sheets.rows('Suppliers')).filter((r) => String(r['organizationId']) === orgId);
    if (active !== null) rows = rows.filter((r) => (r['active'] === true || r['active'] === 'TRUE') === active);
    rows.sort((a, b) => String(a['name']).localeCompare(String(b['name'])));
    return { suppliers: rows.map(toSupplier) };
  }

  async function listRequests(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const orgId = ctx.auth!.organizationId;
    const filters = {
      status: payload['status'] ? enumValue(payload['status'], 'status', REQUEST_STATUSES) : null,
      requesterId: payload['requesterId'] ? validateId(payload['requesterId'], 'requesterId') : null,
    };
    let rows = (await deps.sheets.rows('PurchaseRequests')).filter((r) => String(r['organizationId']) === orgId);
    if (filters.status) rows = rows.filter((r) => String(r['status']) === filters.status);
    if (filters.requesterId) rows = rows.filter((r) => String(r['requesterId']) === filters.requesterId);
    rows.sort((a, b) => String(b['createdAt']).localeCompare(String(a['createdAt'])));
    const itemsAll = (await deps.sheets.rows('PurchaseRequestItems')).filter((r) => String(r['organizationId']) === orgId);
    const itemsByReq = new Map<string, Array<Record<string, unknown>>>();
    for (const it of itemsAll) {
      const k = String(it['purchaseRequestId']);
      const list = itemsByReq.get(k) ?? [];
      list.push(it);
      itemsByReq.set(k, list);
    }
    const quotesAll = (await deps.sheets.rows('Quotes')).filter((r) => String(r['organizationId']) === orgId);
    const quotesByReq = new Map<string, Array<Record<string, unknown>>>();
    for (const q of quotesAll) {
      const k = String(q['purchaseRequestId']);
      const list = quotesByReq.get(k) ?? [];
      list.push(q);
      quotesByReq.set(k, list);
    }
    return {
      requests: rows.map((r) => toRequestListItem(r, itemsByReq.get(String(r['id'])) ?? [], (quotesByReq.get(String(r['id'])) ?? []).length)),
    };
  }

  async function getRequest(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const orgId = ctx.auth!.organizationId;
    const row = await deps.sheets.findOne('PurchaseRequests', (r) => {
      return String(r['id']) === id && String(r['organizationId']) === orgId;
    });
    if (!row) throw ApiError.notFound('Solicitud de compra');
    const items = (await deps.sheets.rows('PurchaseRequestItems'))
      .filter((r) => String(r['organizationId']) === orgId && String(r['purchaseRequestId']) === id)
      .map(toItem);
    const quotes = (await deps.sheets.rows('Quotes'))
      .filter((r) => String(r['organizationId']) === orgId && String(r['purchaseRequestId']) === id);
    const supplierNameById = new Map<string, string>();
    for (const q of quotes) {
      const supplierId = String(q['supplierId']);
      if (!supplierNameById.has(supplierId)) {
        const supplier = await deps.sheets.findOne('Suppliers', (r) => {
          return String(r['id']) === supplierId && String(r['organizationId']) === orgId;
        });
        supplierNameById.set(supplierId, supplier ? String(supplier['name'] ?? '') : '');
      }
    }
    return {
      request: toRequestListItem(row, items, quotes.length),
      items,
      quotes: quotes.map((q) => toQuote(q, supplierNameById.get(String(q['supplierId'])) ?? '')),
    };
  }

  async function listQuotes(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const requestId = validateId(payload['requestId'], 'requestId');
    const orgId = ctx.auth!.organizationId;
    const rows = (await deps.sheets.rows('Quotes'))
      .filter((r) => String(r['organizationId']) === orgId && String(r['purchaseRequestId']) === requestId);
    const supplierNameById = new Map<string, string>();
    for (const r of rows) {
      const supplierId = String(r['supplierId']);
      if (!supplierNameById.has(supplierId)) {
        const supplier = await deps.sheets.findOne('Suppliers', (s) => {
          return String(s['id']) === supplierId && String(s['organizationId']) === orgId;
        });
        supplierNameById.set(supplierId, supplier ? String(supplier['name'] ?? '') : '');
      }
    }
    return { quotes: rows.map((r) => toQuote(r, supplierNameById.get(String(r['supplierId'])) ?? '')) };
  }

  return { listSuppliers, listRequests, getRequest, listQuotes };
}

export type PurchasesHandlers = ReturnType<typeof makePurchasesHandlers>;
