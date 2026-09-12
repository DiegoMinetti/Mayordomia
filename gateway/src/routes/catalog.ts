/**
 * Catalog read endpoints — port of apps-script/Catalog.gs.
 *
 * Every endpoint requires auth (validates the Google access token), scopes the
 * data to the caller's organization, and returns rows mapped to stable
 * shapes that the frontend already consumes.
 */
import { ApiError } from '../errors.js';
import type { SheetsClient } from '../sheets/client.js';
import type { DispatchContext } from '../router/index.js';

function asBool(v: unknown): boolean {
  return v === true || v === 'TRUE' || v === 'true';
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toOrg(row: Record<string, unknown>) {
  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? ''),
    timezone: String(row['timezone'] ?? 'UTC'),
    active: asBool(row['active']),
    ...(row['createdAt'] ? { createdAt: String(row['createdAt']) } : {}),
    ...(row['updatedAt'] ? { updatedAt: String(row['updatedAt']) } : {}),
    version: asNumber(row['version'], 1),
  };
}

function toSite(row: Record<string, unknown>) {
  return {
    id: String(row['id'] ?? ''),
    organizationId: String(row['organizationId'] ?? ''),
    name: String(row['name'] ?? ''),
    address: String(row['address'] ?? ''),
    active: asBool(row['active']),
    ...(row['createdAt'] ? { createdAt: String(row['createdAt']) } : {}),
    ...(row['updatedAt'] ? { updatedAt: String(row['updatedAt']) } : {}),
    version: asNumber(row['version'], 1),
  };
}

function toUser(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {
    id: String(row['id'] ?? ''),
    organizationId: String(row['organizationId'] ?? ''),
    email: String(row['email'] ?? ''),
    name: String(row['name'] ?? ''),
    status: String(row['status'] ?? 'PENDING'),
    version: asNumber(row['version'], 1),
  };
  if (row['picture']) out['picture'] = String(row['picture']);
  return out;
}

function toRole(row: Record<string, unknown>) {
  const raw = row['permissionIds'];
  let permissions: string[] = [];
  if (typeof raw === 'string') {
    permissions = raw.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    permissions = raw.map(String);
  }
  return {
    id: String(row['id'] ?? ''),
    organizationId: String(row['organizationId'] ?? ''),
    name: String(row['name'] ?? ''),
    permissionIds: permissions,
    version: asNumber(row['version'], 1),
  };
}

export interface CatalogHandlersDeps {
  sheets: SheetsClient;
}

export function makeCatalogHandlers(deps: CatalogHandlersDeps) {
  async function organization(_payload: Record<string, unknown>, ctx: DispatchContext) {
    const orgId = ctx.auth!.organizationId;
    const row = await deps.sheets.findOne('Organizations', (r) => String(r['id']) === orgId);
    if (!row) throw ApiError.notFound('Organization');
    return { organization: toOrg(row) };
  }

  async function listOrganizations(payload: Record<string, unknown>, ctx: DispatchContext) {
    const single = await organization(payload, ctx);
    return { organizations: [single.organization] };
  }

  async function listSites(_payload: Record<string, unknown>, ctx: DispatchContext) {
    const orgId = ctx.auth!.organizationId;
    const rows = (await deps.sheets.rows('Sites')).filter(
      (r) => String(r['organizationId']) === orgId,
    );
    return { sites: rows.map(toSite) };
  }

  async function listUsers(_payload: Record<string, unknown>, ctx: DispatchContext) {
    const orgId = ctx.auth!.organizationId;
    const rows = (await deps.sheets.rows('Users')).filter(
      (r) => String(r['organizationId']) === orgId,
    );
    return { users: rows.map(toUser) };
  }

  async function listRoles(_payload: Record<string, unknown>, ctx: DispatchContext) {
    const orgId = ctx.auth!.organizationId;
    const rows = (await deps.sheets.rows('Roles')).filter(
      (r) => String(r['organizationId']) === orgId,
    );
    return { roles: rows.map(toRole) };
  }

  return { organization, listOrganizations, listSites, listUsers, listRoles };
}

export type CatalogHandlers = ReturnType<typeof makeCatalogHandlers>;
