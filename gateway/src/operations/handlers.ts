/**
 * Operations read endpoints. PR 4 covers list/get only.
 * Mutations (deliver, returnDeliveryItem) come in PR 5.
 */
import { ApiError } from '../errors.js';
import { enumValue, id as validateId, object } from '../validation.js';
import type { Repository } from '../repository/index.js';
import type { DispatchContext } from '../router/index.js';

const DELIVERY_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export interface OperationsHandlersDeps {
  repo: Repository;
}

function toDelivery(r: Record<string, unknown>) {
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    requestId: String(r['requestId'] ?? ''),
    deliveredBy: String(r['deliveredBy'] ?? ''),
    deliveredAt: String(r['deliveredAt'] ?? ''),
    siteId: r['siteId'] ? String(r['siteId']) : undefined,
    recipientName: String(r['recipientName'] ?? ''),
    notes: r['notes'] ? String(r['notes']) : undefined,
    status: String(r['status'] ?? 'DRAFT'),
    version: Number(r['version'] ?? 1),
  };
}

function toDeliveryItem(r: Record<string, unknown>) {
  return {
    id: String(r['id'] ?? ''),
    organizationId: String(r['organizationId'] ?? ''),
    deliveryId: String(r['deliveryId'] ?? ''),
    resourceId: String(r['resourceId'] ?? ''),
    quantity: Number(r['quantity'] ?? 0),
    returnedAt: r['returnedAt'] ? String(r['returnedAt']) : undefined,
    returnedBy: r['returnedBy'] ? String(r['returnedBy']) : undefined,
    returnNotes: r['returnNotes'] ? String(r['returnNotes']) : undefined,
    condition: r['condition'] ? String(r['condition']) : undefined,
    version: Number(r['version'] ?? 1),
  };
}

export function makeOperationsHandlers(deps: OperationsHandlersDeps) {
  async function list(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const orgId = ctx.auth!.organizationId;
    const filters = {
      requestId: payload['requestId'] ? validateId(payload['requestId'], 'requestId') : null,
      status: payload['status'] ? enumValue(payload['status'], 'status', DELIVERY_STATUSES) : null,
    };
    let rows = (await deps.repo.rows('Deliveries')).filter(
      (r) => String(r['organizationId']) === orgId,
    );
    if (filters.requestId) rows = rows.filter((r) => String(r['requestId']) === filters.requestId);
    if (filters.status) rows = rows.filter((r) => String(r['status']) === filters.status);
    rows.sort((a, b) =>
      String(b['deliveredAt'] ?? '').localeCompare(String(a['deliveredAt'] ?? '')),
    );
    return { deliveries: rows.map(toDelivery) };
  }

  async function get(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const orgId = ctx.auth!.organizationId;
    const row = await deps.repo.findOne('Deliveries', (r) => {
      return String(r['id']) === id && String(r['organizationId']) === orgId;
    });
    if (!row) throw ApiError.notFound('Entrega');
    const items = (await deps.repo.rows('DeliveryItems'))
      .filter((r) => String(r['organizationId']) === orgId && String(r['deliveryId']) === id)
      .map(toDeliveryItem);
    const open = items.filter((i) => !i.returnedAt).length;
    const progress = {
      totalItems: items.length,
      returnedItems: items.length - open,
      openItems: open,
      damageCount: items.filter((i) => i.condition === 'DAMAGED').length,
    };
    return { delivery: toDelivery(row), items, progress };
  }

  return { list, get };
}

export type OperationsHandlers = ReturnType<typeof makeOperationsHandlers>;
