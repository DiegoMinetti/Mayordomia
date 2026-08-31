import { describe, expect, it } from 'vitest';
import {
  bootstrapFormSchema,
  DEFAULT_TIMEZONE,
  FIRST_USER_ROLE,
  TIMEZONE_REGEX,
} from './bootstrap';

const validBase = {
  organizationName: 'Congregación Central',
  timezone: DEFAULT_TIMEZONE,
  siteName: 'Sede Centro',
  siteAddress: 'Av. Siempre Viva 742',
  acceptTerms: true as const,
};

describe('bootstrapFormSchema', () => {
  it('accepts a complete valid form', () => {
    const parsed = bootstrapFormSchema.safeParse(validBase);
    expect(parsed.success).toBe(true);
  });

  it('treats empty site fields as absent', () => {
    const parsed = bootstrapFormSchema.safeParse({
      ...validBase,
      siteName: '',
      siteAddress: '',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects names shorter than 2 characters', () => {
    const parsed = bootstrapFormSchema.safeParse({ ...validBase, organizationName: 'A' });
    expect(parsed.success).toBe(false);
  });

  it('rejects names longer than 120 characters', () => {
    const parsed = bootstrapFormSchema.safeParse({
      ...validBase,
      organizationName: 'x'.repeat(121),
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown timezones', () => {
    const parsed = bootstrapFormSchema.safeParse({ ...validBase, timezone: 'not-a-tz' });
    expect(parsed.success).toBe(false);
  });

  it('accepts UTC explicitly', () => {
    const parsed = bootstrapFormSchema.safeParse({ ...validBase, timezone: 'UTC' });
    expect(parsed.success).toBe(true);
  });

  it('rejects when terms are not accepted', () => {
    const parsed = bootstrapFormSchema.safeParse({ ...validBase, acceptTerms: false });
    expect(parsed.success).toBe(false);
  });

  it('trims whitespace from the organization name', () => {
    const parsed = bootstrapFormSchema.safeParse({ ...validBase, organizationName: '  Hola  ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.organizationName).toBe('Hola');
    }
  });
});

describe('bootstrap constants', () => {
  it('exposes FIRST_USER_ROLE as SUPER_ADMIN', () => {
    expect(FIRST_USER_ROLE).toBe('SUPER_ADMIN');
  });

  it('default timezone is Buenos Aires', () => {
    expect(TIMEZONE_REGEX.test(DEFAULT_TIMEZONE)).toBe(true);
  });
});
