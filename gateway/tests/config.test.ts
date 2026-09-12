import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { ApiException } from '../src/errors.js';

describe('config', () => {
  it('requires SPREADSHEET_ID', () => {
    expect(() => loadConfig({})).toThrow(/SPREADSHEET_ID/);
  });

  it('parses ALLOWED_ORIGINS as a list', () => {
    const cfg = loadConfig({
      SPREADSHEET_ID: 'ss-1',
      ALLOWED_ORIGINS: 'https://a.com, https://b.com ,',
    });
    expect(cfg.allowedOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(cfg.spreadsheetId).toBe('ss-1');
    expect(cfg.port).toBe(3000);
    expect(cfg.nodeEnv).toBe('development'); // NODE_ENV unset
  });

  it('respects PORT and RATE_LIMIT_*', () => {
    const cfg = loadConfig({
      SPREADSHEET_ID: 'ss-1',
      PORT: '4040',
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_MAX: '5',
      NODE_ENV: 'production',
    });
    expect(cfg.port).toBe(4040);
    expect(cfg.rateLimit).toEqual({ windowMs: 1000, max: 5 });
    expect(cfg.nodeEnv).toBe('production');
  });

  it('throws on invalid PORT', () => {
    expect(() => loadConfig({ SPREADSHEET_ID: 'x', PORT: 'not-a-number' })).toThrow(/PORT inválido/);
  });

  it('treats missing optional envs as undefined', () => {
    const cfg = loadConfig({ SPREADSHEET_ID: 'x' });
    expect(cfg.calendarId).toBeUndefined();
    expect(cfg.resendApiKey).toBeUndefined();
    expect(cfg.publicTokenPepper).toBeUndefined();
    expect(cfg.googleServiceAccountFile).toBeUndefined();
    expect(cfg.googleServiceAccountJson).toBeUndefined();
  });
});
