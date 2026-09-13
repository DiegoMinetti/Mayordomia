/**
 * Public request creation (anonymous QR scan flow).
 *
 *   requests.createPublic — no auth. The caller passes a public token; we hash
 *   it with the server-side pepper, look up the matching PublicAccessTokens row,
 *   enforce a per-token rate limit, and append a new Requests row.
 *
 * Mirrors apps-script/PublicRequests.gs + RateLimit.gs.
 */
import { createHash } from 'node:crypto';
import { ApiError } from '../errors.js';
import { enumValue, id as validateId, object, string, email, safeText } from '../validation.js';
import type { AuditService } from '../audit/service.js';
import type { SheetsClient } from '../sheets/client.js';
import type { DispatchContext } from '../router/index.js';
import { newRequestId } from './repository.js';

const PUBLIC_REQUEST_TYPES = [
  'RESOURCE',
  'LOCATION',
  'AUDIO',
  'MULTIMEDIA',
  'LIGHTING',
  'SUPPORT',
  'MAINTENANCE',
  'PURCHASE',
  'OTHER',
] as const;

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function makeRateLimiter(config: RateLimitConfig) {
  const buckets = new Map<string, Bucket>();
  function assertAllowed(key: string, max = config.max, windowMs = config.windowMs): void {
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    if (existing.count >= max) {
      throw ApiError.rateLimited();
    }
    existing.count += 1;
  }
  function reset(): void {
    buckets.clear();
  }
  return { assertAllowed, reset };
}

export function hashPublicToken(token: string, pepper: string): string {
  // base64url is the closest equivalent to Apps Script's base64EncodeWebSafe.
  return createHash('sha256').update(token + pepper).digest('base64url');
}

function parsePublicPayload(payload: Record<string, unknown>) {
  object(payload, 'payload');
  return {
    publicToken: validateId(payload['publicToken'], 'publicToken'),
    type: enumValue(payload['type'], 'type', PUBLIC_REQUEST_TYPES),
    requesterName: safeText(payload['requesterName'], 'requesterName', 120),
    requesterEmail: payload['requesterEmail'] ? email(payload['requesterEmail'], 'requesterEmail') : '',
    description: safeText(payload['description'], 'description', 2000),
    requestedFor: payload['requestedFor'] ? string(payload['requestedFor'], 'requestedFor', { max: 40 }) : '',
    // honeypot — Apps Script rejects any request that has this filled in.
    website: payload['website'] ? String(payload['website']) : '',
  };
}

export interface PublicRequestsDeps {
  sheets: SheetsClient;
  audit: AuditService;
  /** Server-side pepper. Required. */
  publicTokenPepper: string;
  rateLimit: { assertAllowed(key: string, max?: number, windowMs?: number): void };
}

export function makePublicRequestsHandlers(deps: PublicRequestsDeps) {
  async function create(payload: Record<string, unknown>, ctx: DispatchContext) {
    const data = parsePublicPayload(payload);
    if (data.website) throw ApiError.badRequest('SPAM_DETECTED', 'Solicitud inválida');
    deps.rateLimit.assertAllowed(data.publicToken);
    const tokenHash = hashPublicToken(data.publicToken, deps.publicTokenPepper);
    const access = await deps.sheets.findOne('PublicAccessTokens', (r) => {
      return String(r['tokenHash']) === tokenHash && String(r['status']) === 'ACTIVE';
    });
    if (!access) throw ApiError.notFound('Acceso público');
    const id = newRequestId();
    const now = new Date().toISOString();
    await deps.sheets.append('Requests', {
      id,
      organizationId: String(access['organizationId'] ?? ''),
      siteId: access['siteId'] ? String(access['siteId']) : '',
      type: data.type,
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      description: data.description,
      requestedFor: data.requestedFor,
      source: 'PUBLIC_QR',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      createdBy: 'public',
      updatedBy: 'public',
      version: 1,
    });
    await deps.audit.record({
      organizationId: String(access['organizationId'] ?? ''),
      actorType: 'PUBLIC',
      action: 'request.createPublic',
      entityType: 'Request',
      entityId: id,
      requestId: ctx.requestId,
    });
    return { id, status: 'PENDING' };
  }
  return { create };
}

export type PublicRequestsHandlers = ReturnType<typeof makePublicRequestsHandlers>;
