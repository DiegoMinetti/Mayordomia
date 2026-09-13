/**
 * Magic-link sign-in: single-use tokens emailed to the user, exchanged for
 * a session. PR 5.
 *
 * Tokens are opaque random strings stored as sha256 hashes (so a DB leak
 * doesn't expose usable links). Default TTL is 15 minutes; consumed on use.
 *
 * `sendMagicLink` is split out so tests + dev mode can stub it: if SMTP is
 * not configured, the function returns the link and the caller can surface
 * it (e.g. log it). When SMTP is configured, the link is sent via the
 * configured provider and NOT returned to the API consumer.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Repository } from '../repository/index.js';
import { ApiError } from '../errors.js';

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export interface CreateMagicLinkInput {
  email: string;
  organizationId: string;
  /** Override the base URL the link points at (defaults to PUBLIC_BASE_URL or ''). */
  baseUrl?: string;
}

export interface CreateMagicLinkResult {
  userId: string;
  token: string;
  expiresAt: string;
}

export interface SendMagicLink {
  /**
   * Send the link to the user. Implementations: SMTP via resend/nodemailer,
   * or a no-op logger in dev when no email provider is configured.
   */
  (args: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

export function newMagicLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashMagicLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createMagicLink(
  repo: Repository,
  input: CreateMagicLinkInput,
  send: SendMagicLink,
  baseUrl: string,
): Promise<CreateMagicLinkResult> {
  const email = input.email.toLowerCase().trim();
  const orgId = input.organizationId;
  if (!email || !orgId) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Falta email u organizationId');
  }
  const user = await repo.findOne('users', (r) => {
    return String(r['email']).toLowerCase() === email && String(r['organizationId']) === orgId;
  });
  if (!user) {
    // Don't reveal whether the user exists. Return a fake result so timing is similar.
    return {
      userId: '',
      token: '',
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString(),
    };
  }
  const userId = String(user['id']);
  const token = newMagicLinkToken();
  const tokenHash = hashMagicLinkToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
  await repo.append('magic_link_tokens', {
    tokenHash,
    userId,
    organizationId: orgId,
    expiresAt,
    consumedAt: '',
    createdAt: new Date().toISOString(),
  });
  const link = `${input.baseUrl ?? baseUrl}/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
  await send({
    to: email,
    subject: 'Tu enlace para iniciar sesión en Mayordomía',
    text: `Iniciá sesión haciendo clic en este enlace (válido por 15 minutos):\n\n${link}`,
    html: `<p>Hacé clic en el siguiente enlace para iniciar sesión (válido por 15 minutos):</p><p><a href="${link}">${link}</a></p>`,
  });
  return { userId, token, expiresAt };
}

export interface ConsumeMagicLinkInput {
  token: string;
}

export interface ConsumeMagicLinkResult {
  userId: string;
  organizationId: string;
  expiresAt: string;
}

export async function consumeMagicLink(
  repo: Repository,
  input: ConsumeMagicLinkInput,
): Promise<ConsumeMagicLinkResult> {
  const token = String(input.token ?? '').trim();
  if (!token) throw ApiError.unauthorized('Token inválido');
  const tokenHash = hashMagicLinkToken(token);
  const row = await repo.findOne('magic_link_tokens', (r) => r['tokenHash'] === tokenHash);
  if (!row) throw ApiError.unauthorized('Token inválido o expirado');
  if (row['consumedAt']) throw ApiError.unauthorized('Token ya utilizado');
  const expiresAt = String(row['expiresAt'] ?? '');
  if (new Date(expiresAt).getTime() <= Date.now()) {
    throw ApiError.unauthorized('Token inválido o expirado');
  }
  // Mark consumed.
  await repo.updateWhere('magic_link_tokens', 'tokenHash', tokenHash, {
    consumedAt: new Date().toISOString(),
  });
  return {
    userId: String(row['userId']),
    organizationId: String(row['organizationId']),
    expiresAt,
  };
}
