/**
 * AuthService — verifies Google access tokens and loads the caller's RBAC
 * context. Mirrors apps-script/Auth.gs.
 *
 *   - verifyIdentity: just the Google token + profile (used by bootstrap)
 *   - context: token + org membership + permissions (used by everything else)
 *   - requirePermission: throws FORBIDDEN if the permission isn't granted
 */
import { google } from 'googleapis';
import { ApiError } from '../errors.js';
import type { Repository } from '../repository/index.js';

export interface Identity {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

export interface AuthContext {
  user: Record<string, unknown>;
  organizationId: string;
  permissions: string[];
}

async function fetchProfile(
  accessToken: string,
): Promise<{
  email: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  sub?: string;
}> {
  const oauth2 = google.oauth2({ version: 'v2', auth: accessToken });
  const res = await oauth2.userinfo.get();
  return res.data as { email: string; name?: string; picture?: string; sub?: string };
}

export async function verifyGoogleToken(accessToken: string | undefined): Promise<string> {
  if (!accessToken) throw ApiError.unauthorized();
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: accessToken });
    const res = await oauth2.tokeninfo({ access_token: accessToken });
    const profile = res.data as { email?: string; email_verified?: string };
    if (!profile.email) throw ApiError.unauthorized('Token de Google inválido o vencido');
    if (profile.email_verified === 'false') {
      throw ApiError.unauthorized('Email de Google no verificado');
    }
    return profile.email.toLowerCase();
  } catch (error) {
    if (error instanceof ApiException) throw error;
    throw ApiError.unauthorized('Token de Google inválido o vencido');
  }
}

export async function verifyIdentity(
  auth: { accessToken?: string } | undefined,
): Promise<Identity> {
  const accessToken = auth?.accessToken;
  const email = await verifyGoogleToken(accessToken);
  let profile: { name?: string; picture?: string; sub?: string } = {};
  try {
    if (accessToken) profile = await fetchProfile(accessToken);
  } catch {
    // profile fetch is best-effort; tokeninfo already validated the email
  }
  return {
    email,
    name: profile.name ?? '',
    picture: profile.picture ?? '',
    sub: profile.sub ?? '',
  };
}

export async function context(
  repo: Repository,
  organizationId: string,
  auth: { accessToken?: string } | undefined,
): Promise<AuthContext> {
  const email = await verifyGoogleToken(auth?.accessToken);
  const user = await repo.findOne('Users', (r) => {
    return (
      String(r['organizationId']) === organizationId &&
      String(r['email']).toLowerCase() === email &&
      r['status'] === 'ACTIVE'
    );
  });
  if (!user) throw ApiError.forbidden('organization.member');
  const assignments = (await repo.rows('UserRoles')).filter(
    (r) =>
      String(r['organizationId']) === organizationId && String(r['userId']) === String(user['id']),
  );
  const roleIds = assignments.map((r) => String(r['roleId']));
  const permissions = (await repo.rows('RolePermissions'))
    .filter(
      (r) =>
        String(r['organizationId']) === organizationId && roleIds.includes(String(r['roleId'])),
    )
    .map((r) => String(r['permission']));
  return { user, organizationId, permissions };
}

export function requirePermission(ctx: AuthContext, permission: string): void {
  if (!ctx.permissions.includes(permission)) throw ApiError.forbidden(permission);
}

// Re-export so test files can stub without importing google directly.
import { ApiException } from '../errors.js';
