/**
 * Events handlers — read paths only in PR 3.
 *
 *   events.list     (auth, perm event.review)
 *   events.get      (auth, perm event.review)
 *   events.upcoming (auth, perm event.review; default 14 days ahead)
 *
 * Mirrors apps-script/Events.gs.
 */
import { ApiError } from '../errors.js';
import { enumValue, id as validateId, object } from '../validation.js';
import type { Repository } from '../repository/index.js';
import type { DispatchContext } from '../router/index.js';
import {
  EVENT_KINDS,
  EVENT_STATUSES,
  type EventRow,
  type EventAreaRow,
  type EventResourceRow,
} from './types.js';

export interface EventsHandlersDeps {
  repo: Repository;
}

async function listEvents(repo: Repository, organizationId: string): Promise<EventRow[]> {
  const rows = await repo.rows('Events');
  return rows
    .filter((r) => String(r['organizationId']) === organizationId)
    .map((r) => r as unknown as EventRow);
}

async function listEventAreas(
  repo: Repository,
  organizationId: string,
  eventId?: string,
): Promise<EventAreaRow[]> {
  const rows = await repo.rows('EventAreas');
  return rows
    .filter((r) => {
      const sameOrg = String(r['organizationId']) === organizationId;
      const sameEvent = eventId === undefined || String(r['eventId']) === eventId;
      return sameOrg && sameEvent;
    })
    .map((r) => r as unknown as EventAreaRow);
}

async function listEventResources(
  repo: Repository,
  organizationId: string,
  eventId?: string,
): Promise<EventResourceRow[]> {
  const rows = await repo.rows('EventResources');
  return rows
    .filter((r) => {
      const sameOrg = String(r['organizationId']) === organizationId;
      const sameEvent = eventId === undefined || String(r['eventId']) === eventId;
      return sameOrg && sameEvent;
    })
    .map((r) => r as unknown as EventResourceRow);
}

function toEvent(e: EventRow, areas: EventAreaRow[], resources: EventResourceRow[]) {
  return {
    id: e.id,
    organizationId: e.organizationId,
    siteId: e.siteId,
    kind: e.kind,
    title: e.title,
    description: e.description,
    startAt: e.startAt,
    endAt: e.endAt,
    status: e.status,
    templateId: e.templateId,
    leadByUserId: e.leadByUserId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    version: e.version,
    areas: areas.map((a) => ({
      id: a.id,
      areaId: a.areaId,
      responsibleUserId: a.responsibleUserId,
      status: a.status,
      version: a.version,
    })),
    resources: resources.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      quantity: r.quantity,
      status: r.status,
      version: r.version,
    })),
  };
}

function parseDateInput(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw ApiError.badRequest('VALIDATION_ERROR', `${label} inválido`);
  }
  return d.toISOString();
}

export function makeEventsHandlers(deps: EventsHandlersDeps) {
  async function list(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const orgId = ctx.auth!.organizationId;
    const filters = {
      siteId: payload['siteId'] ? validateId(payload['siteId'], 'siteId') : null,
      status: payload['status'] ? enumValue(payload['status'], 'status', EVENT_STATUSES) : null,
      kind: payload['kind'] ? enumValue(payload['kind'], 'kind', EVENT_KINDS) : null,
      startAfter: parseDateInput(payload['startAfter'], 'startAfter'),
      endBefore: parseDateInput(payload['endBefore'], 'endBefore'),
    };
    let rows = await listEvents(deps.repo, orgId);
    if (filters.siteId) rows = rows.filter((r) => r.siteId === filters.siteId);
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.kind) rows = rows.filter((r) => r.kind === filters.kind);
    if (filters.startAfter) {
      const cutoff = filters.startAfter;
      rows = rows.filter((r) => new Date(r.startAt).toISOString() >= cutoff);
    }
    if (filters.endBefore) {
      const cutoff = filters.endBefore;
      rows = rows.filter((r) => new Date(r.endAt).toISOString() <= cutoff);
    }
    rows.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const [areas, resources] = await Promise.all([
      listEventAreas(deps.repo, orgId),
      listEventResources(deps.repo, orgId),
    ]);
    const areasByEvent = new Map<string, EventAreaRow[]>();
    for (const a of areas) {
      const list = areasByEvent.get(a.eventId) ?? [];
      list.push(a);
      areasByEvent.set(a.eventId, list);
    }
    const resourcesByEvent = new Map<string, EventResourceRow[]>();
    for (const r of resources) {
      const list = resourcesByEvent.get(r.eventId) ?? [];
      list.push(r);
      resourcesByEvent.set(r.eventId, list);
    }
    return {
      events: rows.map((r) =>
        toEvent(r, areasByEvent.get(r.id) ?? [], resourcesByEvent.get(r.id) ?? []),
      ),
    };
  }

  async function get(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const orgId = ctx.auth!.organizationId;
    const row = await deps.repo.findOne('Events', (r) => {
      return String(r['id']) === id && String(r['organizationId']) === orgId;
    });
    if (!row) throw ApiError.notFound('Evento');
    const [areas, resources] = await Promise.all([
      listEventAreas(deps.repo, orgId, id),
      listEventResources(deps.repo, orgId, id),
    ]);
    return { event: toEvent(row as unknown as EventRow, areas, resources) };
  }

  async function upcoming(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const days = payload['days'] !== undefined ? Number(payload['days']) : 14;
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'days debe estar entre 1 y 365');
    }
    const orgId = ctx.auth!.organizationId;
    const status = payload['status']
      ? enumValue(payload['status'], 'status', EVENT_STATUSES)
      : null;
    const now = new Date();
    const until = new Date(now.getTime() + days * 86_400_000);
    let rows = await listEvents(deps.repo, orgId);
    rows = rows.filter((r) => {
      const start = new Date(r.startAt).getTime();
      return start >= now.getTime() && start <= until.getTime();
    });
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return {
      from: now.toISOString(),
      until: until.toISOString(),
      days,
      events: rows.map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        startAt: r.startAt,
        endAt: r.endAt,
        status: r.status,
        siteId: r.siteId,
      })),
    };
  }

  return { list, get, upcoming };
}

export type EventsHandlers = ReturnType<typeof makeEventsHandlers>;
