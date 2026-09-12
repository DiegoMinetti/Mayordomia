import { describe, it, expect } from 'vitest';
import { string, id, email, enumValue, safeText, object } from '../src/validation.js';
import { ApiException } from '../src/errors.js';

describe('validation', () => {
  it('object() rejects non-objects', () => {
    expect(() => object(null, 'p')).toThrow(ApiException);
    expect(() => object('x', 'p')).toThrow(ApiException);
    expect(() => object([], 'p')).toThrow(ApiException);
    expect(object({ a: 1 })).toEqual({ a: 1 });
  });

  it('string() trims and validates', () => {
    expect(string('  hi  ', 'name')).toBe('hi');
    expect(() => string('', 'name')).toThrow(/obligatorio/);
    expect(() => string('x'.repeat(600), 'name', { max: 100 })).toThrow(/máximo/);
    expect(string('', 'name', { required: false })).toBe('');
  });

  it('id() enforces 6-128 chars alphanumeric/dash/underscore', () => {
    expect(id('org_123456', 'organizationId')).toBe('org_123456');
    expect(() => id('short', 'organizationId')).toThrow();
    expect(() => id('has space here', 'organizationId')).toThrow();
    expect(() => id('x'.repeat(200), 'organizationId')).toThrow();
  });

  it('email() lowercases and validates', () => {
    expect(email('  Foo@Bar.COM  ', 'email')).toBe('foo@bar.com');
    expect(() => email('no-at', 'email')).toThrow();
  });

  it('enumValue() restricts to the allowed list', () => {
    expect(enumValue('A', 't', ['A', 'B'] as const)).toBe('A');
    expect(() => enumValue('C', 't', ['A', 'B'] as const)).toThrow();
  });

  it('safeText() strips angle brackets', () => {
    expect(safeText('<script>alert(1)</script>', 'msg')).toBe('scriptalert(1)/script');
  });
});
