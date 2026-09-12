import { describe, it, expect } from 'vitest';
import { ok, fail } from '../src/envelope.js';

describe('envelope', () => {
  it('ok() wraps data with ok=true', () => {
    const env = ok({ foo: 1 }, 'req-1');
    expect(env.ok).toBe(true);
    if (env.ok) {
      expect(env.data).toEqual({ foo: 1 });
      expect(env.error).toBeNull();
      expect(env.meta.requestId).toBe('req-1');
    }
  });

  it('ok() treats undefined as null', () => {
    const env = ok(undefined, 'req-2');
    expect(env.ok).toBe(true);
    if (env.ok) expect(env.data).toBeNull();
  });

  it('fail() wraps error with ok=false', () => {
    const env = fail('VALIDATION_ERROR', 'bad', 'req-3', { field: 'x' }, 400);
    expect(env.ok).toBe(false);
    if (!env.ok) {
      expect(env.data).toBeNull();
      expect(env.error.code).toBe('VALIDATION_ERROR');
      expect(env.error.message).toBe('bad');
      expect(env.error.details).toEqual({ field: 'x' });
      expect(env.error.status).toBe(400);
    }
  });

  it('fail() omits details and status when not provided', () => {
    const env = fail('INTERNAL_ERROR', 'oops', 'req-4');
    if (!env.ok) {
      expect(env.error.details).toBeUndefined();
      expect(env.error.status).toBeUndefined();
    }
  });
});
