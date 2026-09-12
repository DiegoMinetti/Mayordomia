import { describe, it, expect } from 'vitest';
import { ApiError, ApiException } from '../src/errors.js';

describe('ApiException', () => {
  it('carries code/status/details', () => {
    const e = ApiError.badRequest('VALIDATION_ERROR', 'bad', { field: 'name' });
    expect(e).toBeInstanceOf(ApiException);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.status).toBe(400);
    expect(e.details).toEqual({ field: 'name' });
    expect(e.message).toBe('bad');
    expect(e.name).toBe('ApiException');
  });

  it('factory helpers produce stable codes', () => {
    expect(ApiError.unauthorized().code).toBe('UNAUTHORIZED');
    expect(ApiError.forbidden('config.manage').code).toBe('FORBIDDEN');
    expect(ApiError.forbidden('x').details).toEqual({ permission: 'x' });
    expect(ApiError.notFound('User').status).toBe(404);
    expect(ApiError.rateLimited().status).toBe(429);
    expect(ApiError.conflict('VERSION_MISMATCH', 'stale').status).toBe(409);
    expect(ApiError.internal('CONFIG_MISSING', 'x').status).toBe(500);
  });
});
