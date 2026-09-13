/**
 * /auth/setup — bootstrap endpoint. Idempotent: creates the first
 * organization + super-admin if they don't exist yet, otherwise returns the
 * existing admin.
 *
 * This replaces the Apps Script Bootstrap.gs flow that used to create the
 * initial org descriptor in Drive. Now it's just SQL.
 *
 * Body: { organizationId, organizationName, email, password, name }
 * Returns: { token, expiresAt, user, organization, alreadyExisted: boolean }
 */
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repository/index.js';
import { ApiError } from '../errors.js';
import { hashPassword } from './passwords.js';
import { createSession } from './sessions.js';
import type { Response } from 'express';
import { setSessionCookie } from '../server-shared.js';

export interface SetupInput {
  organizationId: string | undefined;
  organizationName: string | undefined;
  email: string;
  password: string;
  name: string;
  /** Optional timezone, defaults to UTC. */
  timezone: string | undefined;
}

export interface SetupResult {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    organizationId: string;
    email: string;
    name: string;
    status: string;
    createdAt: string;
  };
  organization: { id: string; name: string; timezone: string; active: number; createdAt: string };
  alreadyExisted: boolean;
}

export async function setupBootstrap(
  repo: Repository,
  input: SetupInput,
  res: Response,
): Promise<SetupResult> {
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(input.password ?? '');
  const name = String(input.name ?? '').trim();
  const organizationId =
    String(input.organizationId ?? '').trim() ||
    `org_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const organizationName =
    String(input.organizationName ?? '').trim() || email.split('@')[0] || 'Default';
  const timezone = String(input.timezone ?? 'UTC');
  if (!email || !password || !name) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Faltan email, password u name');
  }

  // Idempotency: if any user already exists with this email (any org), reuse it.
  // If the orgId already exists with a different admin, refuse.
  const existingUser = await repo.findOne(
    'users',
    (r) => String(r['email']).toLowerCase() === email,
  );
  if (existingUser) {
    if (String(existingUser['organizationId']) !== organizationId) {
      throw ApiError.conflict('EMAIL_TAKEN', 'El email ya está registrado en otra organización');
    }
    const { token, session } = await createSession(repo, {
      userId: String(existingUser['id']),
      organizationId,
      userAgent: undefined,
      ip: undefined,
    });
    setSessionCookie(res, token);
    const orgRow = await repo.findOne('organizations', (r) => r['id'] === organizationId);
    return {
      token,
      expiresAt: session.expiresAt,
      alreadyExisted: true,
      user: toUserView(existingUser),
      organization: orgRow
        ? toOrgView(orgRow)
        : { id: organizationId, name: organizationName, timezone, active: 1, createdAt: '' },
    };
  }

  const existingOrg = await repo.findOne('organizations', (r) => r['id'] === organizationId);
  if (existingOrg) {
    throw ApiError.conflict('ORG_TAKEN', 'El organizationId ya existe pero no sos su primer admin');
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  // Create org
  await repo.append('organizations', {
    id: organizationId,
    name: organizationName,
    timezone,
    active: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });
  // Create super admin user
  const userId = `usr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await repo.append('users', {
    id: userId,
    organizationId,
    email,
    name,
    status: 'ACTIVE',
    picture: '',
    passwordHash,
    createdAt: now,
    version: 1,
  });
  // Create SUPER_ADMIN role + assignment
  const roleId = `role_super_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  await repo.append('roles', {
    id: roleId,
    organizationId,
    name: 'SUPER_ADMIN',
    permissionIds: '*',
    createdAt: now,
    updatedAt: now,
    version: 1,
  });
  await repo.append('user_roles', {
    userId,
    roleId,
    organizationId,
    createdAt: now,
  });
  // Wildcard permission grant so the SUPER_ADMIN has every permission string.
  await repo.append('role_permissions', {
    roleId,
    organizationId,
    permission: '*',
  });

  const { token, session } = await createSession(repo, {
    userId,
    organizationId,
    userAgent: undefined,
    ip: undefined,
  });
  setSessionCookie(res, token);

  return {
    token,
    expiresAt: session.expiresAt,
    alreadyExisted: false,
    user: { id: userId, organizationId, email, name, status: 'ACTIVE', createdAt: now },
    organization: {
      id: organizationId,
      name: organizationName,
      timezone,
      active: 1,
      createdAt: now,
    },
  };
}

function toUserView(row: Record<string, unknown>) {
  return {
    id: String(row['id'] ?? ''),
    organizationId: String(row['organizationId'] ?? ''),
    email: String(row['email'] ?? ''),
    name: String(row['name'] ?? ''),
    status: String(row['status'] ?? 'PENDING'),
    createdAt: String(row['createdAt'] ?? ''),
  };
}

function toOrgView(row: Record<string, unknown>) {
  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? ''),
    timezone: String(row['timezone'] ?? 'UTC'),
    active: Number(row['active'] ?? 1),
    createdAt: String(row['createdAt'] ?? ''),
  };
}
