/**
 * Router — mirrors apps-script/Router.gs.
 *
 * Routes are registered with options (auth, identity, permission, audit) and
 * a handler that receives the request payload + context. Dispatch validates
 * the envelope, runs auth if required, checks the permission, executes the
 * handler, and audits if requested.
 *
 *   register('catalog.listUsers', { auth: true }, (payload, ctx) => Catalog.listUsers(payload, ctx))
 *   dispatch({ action, organizationId, auth, payload }, deps)
 *
 * PR 3: `auth.sessionToken` replaces the old `auth.accessToken` (Google OAuth).
 * The HTTP layer extracts the token from `Authorization: Bearer sess_…` or
 * the `mayordomia_session` cookie before building IncomingRequest.
 */
import { ApiError } from '../errors.js';
import { object, string } from '../validation.js';
import * as AuthService from '../auth/service.js';
import type { AuthContext, Identity } from '../auth/service.js';
import type { AuditService } from '../audit/service.js';
import type { Repository } from '../repository/index.js';

export type Handler<Output = unknown> = (
  payload: Record<string, unknown>,
  ctx: DispatchContext,
) => Output | Promise<Output>;

export interface RouteOptions {
  auth?: boolean;
  /** Verify session but skip org membership check (bootstrap flow). */
  identity?: boolean;
  permission?: string;
  audit?: boolean;
}

export interface DispatchContext {
  requestId: string;
  auth?: AuthContext;
  identity?: Identity;
}

export interface DispatchDeps {
  repo: Repository;
  audit: AuditService;
}

interface Route {
  options: RouteOptions;
  handler: Handler;
}

const routes = new Map<string, Route>();

export function register(action: string, options: RouteOptions, handler: Handler): void {
  routes.set(action, { options, handler });
}

/** Test-only helper. */
export function _reset(): void {
  routes.clear();
}

export interface IncomingRequest {
  action: string;
  organizationId?: string;
  auth?: { sessionToken?: string };
  payload?: Record<string, unknown>;
}

export async function dispatch(req: IncomingRequest, deps: DispatchDeps): Promise<unknown> {
  object(req, 'request');
  string(req.action, 'action', { max: 100 });

  const route = routes.get(req.action);
  if (!route) throw ApiError.notFound('Acción');

  const ctx: DispatchContext = { requestId: '' };

  if (route.options.auth) {
    const orgId = string(req.organizationId, 'organizationId', { min: 6, max: 128 });
    // Match apps-script/Validation.id() shape (6-128 chars, alphanumeric/dash/underscore).
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(orgId)) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'organizationId inválido');
    }
    ctx.auth = await AuthService.context(deps.repo, orgId, req.auth ?? {});
    if (route.options.permission) AuthService.requirePermission(ctx.auth, route.options.permission);
  } else if (route.options.identity) {
    ctx.identity = await AuthService.verifyIdentity(deps.repo, req.auth ?? {});
  }

  const result = await route.handler(req.payload ?? {}, ctx);

  if (route.options.audit && ctx.auth) {
    await deps.audit.record({
      organizationId: ctx.auth.organizationId,
      actorId: String(ctx.auth.user['id'] ?? ''),
      actorType: 'USER',
      action: req.action,
      requestId: ctx.requestId,
    });
  }

  return result;
}

/** Number of registered routes (test helper). */
export function _routeCount(): number {
  return routes.size;
}
