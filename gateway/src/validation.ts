/**
 * Validation helpers. Mirrors apps-script/Validation.gs. Each helper throws
 * ApiError.badRequest on failure; otherwise returns the cleaned value.
 */
import { ApiError } from './errors.js';

const ID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface StringOpts {
  required?: boolean;
  min?: number;
  max?: number;
}

export function object(value: unknown, label = 'payload'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw ApiError.badRequest('INVALID_PAYLOAD', `${label} debe ser un objeto`);
  }
  return value as Record<string, unknown>;
}

export function string(value: unknown, label: string, opts: StringOpts = {}): string {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean && opts.required !== false) {
    throw ApiError.badRequest('VALIDATION_ERROR', `${label} es obligatorio`);
  }
  const max = opts.max ?? 500;
  if (clean.length > max) throw ApiError.badRequest('VALIDATION_ERROR', `${label} excede el máximo`);
  const min = opts.min ?? 0;
  if (clean.length < min) throw ApiError.badRequest('VALIDATION_ERROR', `${label} es demasiado corto`);
  return clean;
}

export function id(value: unknown, label: string): string {
  const clean = string(value, label, { max: 128 });
  if (!ID_RE.test(clean)) throw ApiError.badRequest('VALIDATION_ERROR', `${label} inválido`);
  return clean;
}

export function email(value: unknown, label: string): string {
  const clean = string(value, label, { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(clean)) throw ApiError.badRequest('VALIDATION_ERROR', `${label} inválido`);
  return clean;
}

export function enumValue<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw ApiError.badRequest('VALIDATION_ERROR', `${label} inválido`);
  }
  return value as T;
}

export function safeText(value: unknown, label: string, max = 2000): string {
  return string(value, label, { max }).replace(/[<>]/g, '');
}
