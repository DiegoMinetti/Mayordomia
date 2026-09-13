/**
 * Auth routes — local email + password.
 *
 *   POST /auth/register   { email, password, organizationId, name }     → { token, user }
 *   POST /auth/login      { email, password, organizationId }          → { token, user }
 *   POST /auth/logout                                               → { ok: true }
 *   POST /auth/refresh                                               → { token, expiresAt }
 *   POST /auth/me                                                   → { user }
 *
 * The `organizationId` parameter on register/login keeps the model
 * multi-tenant: a user record is scoped to a single org, and sessions are
 * also org-scoped so RBAC stays clean.
 */
import { randomUUID } from 'node:crypto';
import { ApiError, ApiException } from '../errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import {
  createSession,
  findSession,
  revokeSession,
  SESSION_TTL_MS,
  isSessionToken,
  type SessionRecord,
} from './sessions.js';
import type { Repository } from '../repository/index.js';

export interface AuthRoutesDeps {
  repo: Repository;
}

export interface UserView {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
}

function toUserView(row: Record<string, unknown>): UserView {
  return {
    id: String(row['id'] ?? ''),
    organizationId: String(row['organizationId'] ?? ''),
    email: String(row['email'] ?? ''),
    name: String(row['name'] ?? ''),
    status: String(row['status'] ?? 'PENDING'),
    createdAt: String(row['createdAt'] ?? ''),
  };
}

async function loadUser(repo: Repository, email: string, organizationId: string) {
  return repo.findOne('users', (r) => {
    return (
      String(r['email']).toLowerCase() === email.toLowerCase() &&
      String(r['organizationId']) === organizationId
    );
  });
}

export function makeAuthRoutes(deps: AuthRoutesDeps) {
  async function register(payload: Record<string, unknown>) {
    const email = String(payload['email'] ?? '').trim();
    const password = String(payload['password'] ?? '');
    const organizationId = String(payload['organizationId'] ?? '').trim();
    const name = String(payload['name'] ?? '').trim();
    if (!email || !password || !organizationId) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Faltan email, password u organizationId');
    }

    // The /auth/register endpoint only adds a user to an existing org. If
    // the org doesn't exist yet, the FK on users.organization_id would
    // fail with a generic 500. Check first and return a clear ORG_NOT_FOUND
    // so the UI can guide the user to /auth/setup (which bootstraps the
    // org + first admin in one call).
    const orgRow = await deps.repo.findOne('organizations', (r) => r['id'] === organizationId);
    if (!orgRow) {
      throw new ApiException(
        'ORG_NOT_FOUND',
        `La organización "${organizationId}" no existe. Si es la primera cuenta de esa congregación, corré POST /api/auth/setup primero para crearla.`,
        404,
      );
    }

    const existing = await loadUser(deps.repo, email, organizationId);
    if (existing) {
      throw ApiError.conflict(
        'USER_EXISTS',
        'Ya existe un usuario con ese email en esta organización',
      );
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    await deps.repo.append('users', {
      id,
      organizationId,
      email,
      name,
      status: 'ACTIVE',
      picture: '',
      passwordHash,
      createdAt: now,
      version: 1,
    });

    const { token, session } = await createSession(deps.repo, {
      userId: id,
      organizationId,
      userAgent:
        typeof payload['userAgent'] === 'string' ? String(payload['userAgent']) : undefined,
      ip: typeof payload['ip'] === 'string' ? String(payload['ip']) : undefined,
    });

    const userRow = await deps.repo.findOne('users', (r) => r['id'] === id);
    return {
      token,
      expiresAt: session.expiresAt,
      user: userRow
        ? toUserView(userRow)
        : { id, organizationId, email, name, status: 'ACTIVE', createdAt: now },
    };
  }

  async function login(payload: Record<string, unknown>) {
    const email = String(payload['email'] ?? '').trim();
    const password = String(payload['password'] ?? '');
    const organizationId = String(payload['organizationId'] ?? '').trim();
    if (!email || !password || !organizationId) {
      throw ApiError.unauthorized('Credenciales inválidas');
    }

    const user = await loadUser(deps.repo, email, organizationId);
    if (!user) {
      // Constant-time-ish: still hash a dummy to avoid timing leak.
      await verifyPassword(
        password,
        '$2a$12$0000000000000000000000.0000000000000000000000000000000000',
      );
      throw ApiError.unauthorized('Credenciales inválidas');
    }
    if (String(user['status']) !== 'ACTIVE') {
      throw ApiError.forbidden('user.inactive');
    }
    const hash = String(user['passwordHash'] ?? '');
    if (!hash) {
      throw ApiError.unauthorized('Credenciales inválidas');
    }
    const ok = await verifyPassword(password, hash);
    if (!ok) {
      throw ApiError.unauthorized('Credenciales inválidas');
    }

    const { token, session } = await createSession(deps.repo, {
      userId: String(user['id']),
      organizationId: String(user['organizationId']),
      userAgent:
        typeof payload['userAgent'] === 'string' ? String(payload['userAgent']) : undefined,
      ip: typeof payload['ip'] === 'string' ? String(payload['ip']) : undefined,
    });

    return { token, expiresAt: session.expiresAt, user: toUserView(user) };
  }

  async function logout(token: string | undefined) {
    if (!token || !isSessionToken(token)) {
      return { ok: true };
    }
    await revokeSession(deps.repo, token);
    return { ok: true };
  }

  async function refresh(token: string | undefined) {
    if (!token || !isSessionToken(token)) {
      throw ApiError.unauthorized('Sesión inválida');
    }
    const existing = await findSession(deps.repo, token);
    if (!existing) {
      throw ApiError.unauthorized('Sesión inválida');
    }
    // Rotate: revoke old, create new with same TTL.
    await revokeSession(deps.repo, token);
    const { token: newToken, session } = await createSession(deps.repo, {
      userId: existing.userId,
      organizationId: existing.organizationId,
      userAgent: existing.userAgent,
      ip: existing.ip,
    });
    return { token: newToken, expiresAt: session.expiresAt, ttlMs: SESSION_TTL_MS };
  }

  async function me(token: string | undefined) {
    if (!token || !isSessionToken(token)) {
      throw ApiError.unauthorized('Sesión inválida');
    }
    const session = await findSession(deps.repo, token);
    if (!session) {
      throw ApiError.unauthorized('Sesión inválida');
    }
    const user = await deps.repo.findOne('users', (r) => r['id'] === session.userId);
    if (!user) {
      throw ApiError.unauthorized('Sesión inválida');
    }
    return { user: toUserView(user), session: sessionView(session) };
  }

  return { register, login, logout, refresh, me };
}

function sessionView(s: SessionRecord) {
  return {
    id: s.id,
    userId: s.userId,
    organizationId: s.organizationId,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
  };
}

export type AuthRoutes = ReturnType<typeof makeAuthRoutes>;
