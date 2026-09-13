/**
 * Session tokens — opaque random strings stored as SHA-256 hashes.
 *
 * Why opaque (not JWT): we don't need to be stateless for this scale and
 * opaque tokens give us server-side revocation, which JWT cannot. The hash
 * in `sessions.id` means a DB leak doesn't expose live tokens.
 *
 * Format: `sess_<43 base64url chars>` (~256 bits). Prefix makes them
 * greppable in logs without leaking the value.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Repository } from '../repository/index.js';

export const SESSION_PREFIX = 'sess_';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionRecord {
  id: string;
  userId: string;
  organizationId: string;
  expiresAt: string;
  createdAt: string;
  userAgent: string | undefined;
  ip: string | undefined;
}

export interface CreateSessionInput {
  userId: string;
  organizationId: string;
  userAgent: string | undefined;
  ip: string | undefined;
  ttlMs?: number;
}

export interface CreateSessionResult {
  token: string;
  session: SessionRecord;
}

export function newSessionToken(): string {
  return SESSION_PREFIX + randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isSessionToken(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith(SESSION_PREFIX) &&
    value.length === SESSION_PREFIX.length + 43
  );
}

export async function createSession(
  repo: Repository,
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const token = newSessionToken();
  const id = hashSessionToken(token);
  const ttl = input.ttlMs ?? SESSION_TTL_MS;
  const now = Date.now();
  const expiresAt = new Date(now + ttl).toISOString();
  const createdAt = new Date(now).toISOString();

  await repo.append('sessions', {
    id,
    userId: input.userId,
    organizationId: input.organizationId,
    expiresAt,
    createdAt,
    userAgent: input.userAgent ?? '',
    ip: input.ip ?? '',
  });

  return {
    token,
    session: {
      id,
      userId: input.userId,
      organizationId: input.organizationId,
      expiresAt,
      createdAt,
      userAgent: input.userAgent,
      ip: input.ip,
    },
  };
}

export async function findSession(repo: Repository, token: string): Promise<SessionRecord | null> {
  const id = hashSessionToken(token);
  const row = await repo.findOne('sessions', (r) => r['id'] === id);
  if (!row) return null;
  if (row['revokedAt']) return null;
  const expiresAt = String(row['expiresAt'] ?? '');
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return null;
  return {
    id: String(row['id']),
    userId: String(row['userId']),
    organizationId: String(row['organizationId']),
    expiresAt,
    createdAt: String(row['createdAt'] ?? ''),
    userAgent: row['userAgent'] ? String(row['userAgent']) : undefined,
    ip: row['ip'] ? String(row['ip']) : undefined,
  };
}

export async function revokeSession(repo: Repository, token: string): Promise<boolean> {
  const id = hashSessionToken(token);
  const now = new Date().toISOString();
  return repo.updateWhere('sessions', 'id', id, { revokedAt: now });
}

export async function revokeAllSessionsForUser(repo: Repository, userId: string): Promise<number> {
  const rows = await repo.rows('sessions');
  const now = new Date().toISOString();
  let count = 0;
  for (const row of rows) {
    if (row['userId'] === userId && !row['revokedAt']) {
      await repo.updateWhere('sessions', 'id', String(row['id']), { revokedAt: now });
      count++;
    }
  }
  return count;
}
