/**
 * Shared helpers between server.ts and the auth modules. Kept tiny so it
 * stays import-graph-clean.
 */
import type { Response } from 'express';

export const SESSION_COOKIE = 'mayordomia_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}
