/**
 * Passkey (WebAuthn) auth — PR 6.
 *
 * Uses @simplewebauthn/server for the WebAuthn ceremony. We persist challenges
 * in `webauthn_challenges` so multi-instance deploys work and the 5-minute
 * TTL is enforced server-side.
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { Repository } from '../repository/index.js';
import { ApiError } from '../errors.js';
import { createSession } from './sessions.js';
import { setSessionCookie } from '../server-shared.js';

export const RP_ID = process.env['PASSKEY_RP_ID'] ?? 'localhost';
export const RP_NAME = process.env['PASSKEY_RP_NAME'] ?? 'Mayordomía';
export const ORIGIN = process.env['PASSKEY_ORIGIN'] ?? `http://${RP_ID}:5173`;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function challengeTtl(): string {
  return new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
}

function extractChallengeFromClientDataJSON(b64: string): string | undefined {
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const match = /"challenge"\s*:\s*"([^"]+)"/.exec(json);
    return match?.[1];
  } catch {
    return undefined;
  }
}

const ALLOWED_TRANSPORTS = [
  'usb',
  'nfc',
  'ble',
  'internal',
  'cable',
  'hybrid',
  'smart-card',
] as const;
type Transport = (typeof ALLOWED_TRANSPORTS)[number];

function parseTransports(raw: string): Transport[] {
  return raw
    .split(',')
    .filter((t): t is Transport => (ALLOWED_TRANSPORTS as readonly string[]).includes(t));
}

export async function startRegistration(
  repo: Repository,
  input: { userId: string; organizationId: string },
): Promise<ReturnType<typeof generateRegistrationOptions>> {
  const existingCreds = await repo.rows('webauthn_credentials');
  const excludeCredentials = existingCreds
    .filter((r) => String(r['userId']) === input.userId)
    .map((r) => ({
      id: String(r['credentialId']),
      transports: parseTransports(String(r['transports'] ?? '')),
    }));
  const userName = `user-${input.userId.slice(0, 8)}`;
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Uint8Array.from(Buffer.from(input.userId)),
    userName,
    userDisplayName: userName,
    timeout: 60_000,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });
  await repo.append('webauthn_challenges', {
    challenge: options.challenge,
    userId: input.userId,
    organizationId: input.organizationId,
    purpose: 'registration',
    expiresAt: challengeTtl(),
    createdAt: new Date().toISOString(),
  });
  return options;
}

export async function finishRegistration(
  repo: Repository,
  input: {
    userId: string;
    organizationId: string;
    response: import('@simplewebauthn/types').RegistrationResponseJSON;
  },
): Promise<{ credentialId: string }> {
  const challenge = extractChallengeFromClientDataJSON(input.response.response.clientDataJSON);
  if (!challenge) throw ApiError.badRequest('VALIDATION_ERROR', 'Challenge inválido');
  const row = await repo.findOne(
    'webauthn_challenges',
    (r) => r['challenge'] === challenge && r['purpose'] === 'registration',
  );
  if (!row) throw ApiError.badRequest('VALIDATION_ERROR', 'Challenge no encontrado');
  if (String(row['userId']) !== input.userId) throw ApiError.forbidden('user.mismatch');
  if (new Date(String(row['expiresAt'])).getTime() <= Date.now()) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Challenge expirado');
  }
  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Attestation inválida');
  }
  const regInfo = verification.registrationInfo;
  const credentialId = Buffer.from(regInfo.credentialID).toString('base64url');
  const publicKey = Buffer.from(regInfo.credentialPublicKey).toString('base64url');
  await repo.append('webauthn_credentials', {
    credentialId,
    userId: input.userId,
    organizationId: input.organizationId,
    publicKey,
    counter: regInfo.counter ?? 0,
    transports: '',
    createdAt: new Date().toISOString(),
    lastUsedAt: '',
  });
  await repo.updateWhere('webauthn_challenges', 'challenge', challenge, {
    consumedAt: new Date().toISOString(),
  });
  return { credentialId };
}

export async function startAuthentication(
  repo: Repository,
  organizationId: string,
): Promise<ReturnType<typeof generateAuthenticationOptions>> {
  const allowCredentials = (await repo.rows('webauthn_credentials'))
    .filter((r) => String(r['organizationId']) === organizationId)
    .map((r) => ({
      id: String(r['credentialId']),
      transports: parseTransports(String(r['transports'] ?? '')),
    }));
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    timeout: 60_000,
    userVerification: 'preferred',
    allowCredentials,
  });
  await repo.append('webauthn_challenges', {
    challenge: options.challenge,
    userId: '',
    organizationId,
    purpose: 'authentication',
    expiresAt: challengeTtl(),
    createdAt: new Date().toISOString(),
  });
  return options;
}

export interface FinishAuthenticationResult {
  token: string;
  userId: string;
  organizationId: string;
  expiresAt: string;
}

export async function finishAuthentication(
  repo: Repository,
  input: {
    organizationId: string;
    response: import('@simplewebauthn/types').AuthenticationResponseJSON;
  },
  res: { cookie: (name: string, value: string, opts: object) => unknown },
): Promise<FinishAuthenticationResult> {
  const challenge = extractChallengeFromClientDataJSON(input.response.response.clientDataJSON);
  if (!challenge) throw ApiError.badRequest('VALIDATION_ERROR', 'Challenge inválido');
  const row = await repo.findOne(
    'webauthn_challenges',
    (r) => r['challenge'] === challenge && r['purpose'] === 'authentication',
  );
  if (!row) throw ApiError.badRequest('VALIDATION_ERROR', 'Challenge no encontrado');
  if (new Date(String(row['expiresAt'])).getTime() <= Date.now()) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Challenge expirado');
  }
  const credentialId = String(input.response.id ?? '');
  const cred = await repo.findOne(
    'webauthn_credentials',
    (r) => r['credentialId'] === credentialId,
  );
  if (!cred) throw ApiError.unauthorized('Credential desconocida');
  if (String(cred['organizationId']) !== input.organizationId) {
    throw ApiError.forbidden('organization.mismatch');
  }
  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
    authenticator: {
      credentialID: credentialId,
      credentialPublicKey: new Uint8Array(Buffer.from(String(cred['publicKey']), 'base64url')),
      counter: Number(cred['counter'] ?? 0),
    },
  });
  if (!verification.verified) throw ApiError.unauthorized('Verificación falló');
  await repo.updateWhere('webauthn_credentials', 'credentialId', credentialId, {
    counter: verification.authenticationInfo.newCounter,
    lastUsedAt: new Date().toISOString(),
  });
  await repo.updateWhere('webauthn_challenges', 'challenge', challenge, {
    consumedAt: new Date().toISOString(),
  });
  const userId = String(cred['userId']);
  const { token, session } = await createSession(repo, {
    userId,
    organizationId: input.organizationId,
    userAgent: undefined,
    ip: undefined,
  });
  setSessionCookie(res as never, token);
  return { token, userId, organizationId: input.organizationId, expiresAt: session.expiresAt };
}
