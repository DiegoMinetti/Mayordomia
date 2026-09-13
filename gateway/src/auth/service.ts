/**
 * AuthService — local session-based auth. Mirrors the Apps Script Auth.gs
 * contract (Identity, AuthContext, requirePermission) but uses session
 * tokens instead of Google OAuth access tokens.
 *
 *   - verifyIdentity: just the session user (used by /setup bootstrap).
 *   - context: session token + org membership + permissions (used by
 *     everything else).
 *   - requirePermission: throws FORBIDDEN if the permission isn't granted.
 */
import { ApiError } from '../errors.js';
import type { Repository } from '../repository/index.js';
import { findSession, isSessionToken, type SessionRecord } from './sessions.js';

export interface Identity {
  /** Stable user id. */
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthContext {
  user: Record<string, unknown>;
  organizationId: string;
  permissions: string[];
  session: SessionRecord;
}

async function loadSession(repo: Repository, token: string | undefined): Promise<SessionRecord> {
  if (!token || !isSessionToken(token)) {
    throw ApiError.unauthorized('Sesión inválida');
  }
  const session = await findSession(repo, token);
  if (!session) {
    throw ApiError.unauthorized('Sesión inválida');
  }
  return session;
}

export async function verifyIdentity(
  repo: Repository,
  auth: { sessionToken?: string } | undefined,
): Promise<Identity> {
  const session = await loadSession(repo, auth?.sessionToken);
  const user = await repo.findOne('users', (r) => r['id'] === session.userId);
  if (!user) throw ApiError.unauthorized('Sesión inválida');
  return {
    sub: String(user['id']),
    email: String(user['email'] ?? ''),
    name: String(user['name'] ?? ''),
    picture: String(user['picture'] ?? ''),
  };
}

export async function context(
  repo: Repository,
  organizationId: string,
  auth: { sessionToken?: string } | undefined,
): Promise<AuthContext> {
  const session = await loadSession(repo, auth?.sessionToken);
  if (session.organizationId !== organizationId) {
    throw ApiError.forbidden('organization.mismatch');
  }
  const user = await repo.findOne('users', (r) => r['id'] === session.userId);
  if (!user) throw ApiError.unauthorized('Sesión inválida');
  if (String(user['status']) !== 'ACTIVE') {
    throw ApiError.forbidden('user.inactive');
  }
  const assignments = (await repo.rows('user_roles')).filter(
    (r) =>
      String(r['organizationId']) === organizationId && String(r['userId']) === String(user['id']),
  );
  const roleIds = assignments.map((r) => String(r['roleId']));
  const permissions = (await repo.rows('role_permissions'))
    .filter(
      (r) =>
        String(r['organizationId']) === organizationId && roleIds.includes(String(r['roleId'])),
    )
    .map((r) => String(r['permission']));
  return { user, organizationId, permissions, session };
}

export function requirePermission(ctx: AuthContext, permission: string): void {
  if (!ctx.permissions.includes(permission)) throw ApiError.forbidden(permission);
}
