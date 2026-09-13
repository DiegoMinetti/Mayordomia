/**
 * Resources handlers — read paths only in PR 3.
 *
 *   resources.list          (auth, perm resource.review)
 *   resources.get           (auth, perm resource.review)
 *   resources.listLocations (auth, perm resource.review)
 *   resources.getLocation   (auth, perm resource.review)
 *
 * Reservations, movements, and availability check are deferred to PR 4.
 * Mirrors apps-script/Resources.gs.
 */
import { ApiError } from '../errors.js';
import { enumValue, id as validateId, object } from '../validation.js';
import type { Repository } from '../repository/index.js';
import type { DispatchContext } from '../router/index.js';
import {
  RESOURCE_KINDS,
  RESOURCE_STATUSES,
  LOCATION_KINDS,
  type ResourceRow,
  type LocationRow,
} from './types.js';

export interface ResourcesHandlersDeps {
  repo: Repository;
}

async function listResources(repo: Repository, organizationId: string): Promise<ResourceRow[]> {
  const rows = await repo.rows('Resources');
  return rows
    .filter((r) => String(r['organizationId']) === organizationId)
    .map((r) => r as unknown as ResourceRow);
}

async function listLocations(repo: Repository, organizationId: string): Promise<LocationRow[]> {
  const rows = await repo.rows('Locations');
  return rows
    .filter((r) => String(r['organizationId']) === organizationId)
    .map((r) => r as unknown as LocationRow);
}

function toResource(r: ResourceRow) {
  return {
    id: r.id,
    organizationId: r.organizationId,
    siteId: r.siteId,
    kind: r.kind,
    name: r.name,
    description: r.description,
    status: r.status,
    areaId: r.areaId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    version: r.version,
  };
}

function toLocation(l: LocationRow) {
  return {
    id: l.id,
    organizationId: l.organizationId,
    siteId: l.siteId,
    kind: l.kind,
    name: l.name,
    address: l.address,
    parentId: l.parentId,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    version: l.version,
  };
}

export function makeResourcesHandlers(deps: ResourcesHandlersDeps) {
  async function list(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const orgId = ctx.auth!.organizationId;
    const filters = {
      siteId: payload['siteId'] ? validateId(payload['siteId'], 'siteId') : null,
      areaId: payload['areaId'] ? validateId(payload['areaId'], 'areaId') : null,
      kind: payload['kind'] ? enumValue(payload['kind'], 'kind', RESOURCE_KINDS) : null,
      status: payload['status'] ? enumValue(payload['status'], 'status', RESOURCE_STATUSES) : null,
    };
    let rows = await listResources(deps.repo, orgId);
    if (filters.siteId) rows = rows.filter((r) => r.siteId === filters.siteId);
    if (filters.areaId) rows = rows.filter((r) => r.areaId === filters.areaId);
    if (filters.kind) rows = rows.filter((r) => r.kind === filters.kind);
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { resources: rows.map(toResource) };
  }

  async function get(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const orgId = ctx.auth!.organizationId;
    const row = await deps.repo.findOne('Resources', (r) => {
      return String(r['id']) === id && String(r['organizationId']) === orgId;
    });
    if (!row) throw ApiError.notFound('Recurso');
    return { resource: toResource(row as unknown as ResourceRow) };
  }

  async function listLocationsHandler(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const orgId = ctx.auth!.organizationId;
    const filters = {
      siteId: payload['siteId'] ? validateId(payload['siteId'], 'siteId') : null,
      kind: payload['kind'] ? enumValue(payload['kind'], 'kind', LOCATION_KINDS) : null,
      parentId: payload['parentId'] ? validateId(payload['parentId'], 'parentId') : null,
    };
    let rows = await listLocations(deps.repo, orgId);
    if (filters.siteId) rows = rows.filter((r) => r.siteId === filters.siteId);
    if (filters.kind) rows = rows.filter((r) => r.kind === filters.kind);
    if (filters.parentId) rows = rows.filter((r) => r.parentId === filters.parentId);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { locations: rows.map(toLocation) };
  }

  async function getLocation(payload: Record<string, unknown>, ctx: DispatchContext) {
    object(payload, 'payload');
    const id = validateId(payload['id'], 'id');
    const orgId = ctx.auth!.organizationId;
    const row = await deps.repo.findOne('Locations', (r) => {
      return String(r['id']) === id && String(r['organizationId']) === orgId;
    });
    if (!row) throw ApiError.notFound('Espacio');
    return { location: toLocation(row as unknown as LocationRow) };
  }

  return { list, get, listLocations: listLocationsHandler, getLocation };
}

export type ResourcesHandlers = ReturnType<typeof makeResourcesHandlers>;
