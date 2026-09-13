import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('config', () => {
  it('uses :memory: as the default DB_PATH when NODE_ENV=test and DB_PATH is unset', () => {
    const cfg = loadConfig({ NODE_ENV: 'test' });
    expect(cfg.dbPath).toBe(':memory:');
  });

  it('uses a file path as the default DB_PATH for development and production', () => {
    const dev = loadConfig({});
    expect(dev.dbPath).toBe('./data/mayordomia-development.db');
    const prod = loadConfig({ NODE_ENV: 'production' });
    expect(prod.dbPath).toBe('./data/mayordomia-production.db');
  });

  it('honors DB_PATH when set, overriding the default', () => {
    const cfg = loadConfig({ DB_PATH: '/var/data/may.db' });
    expect(cfg.dbPath).toBe('/var/data/may.db');
  });

  it('SPREADSHEET_ID is now optional (deprecated during Sheets→SQLite migration)', () => {
    const cfg = loadConfig({});
    expect(cfg.spreadsheetId).toBeUndefined();
  });

  it('parses ALLOWED_ORIGINS as a list', () => {
    const cfg = loadConfig({
      ALLOWED_ORIGINS: 'https://a.com, https://b.com ,',
    });
    expect(cfg.allowedOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(cfg.port).toBe(3000);
    expect(cfg.nodeEnv).toBe('development'); // NODE_ENV unset
  });

  it('respects PORT and RATE_LIMIT_*', () => {
    const cfg = loadConfig({
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
    expect(() => loadConfig({ PORT: 'not-a-number' })).toThrow(/PORT inválido/);
  });

  it('treats missing optional envs as undefined', () => {
    const cfg = loadConfig({});
    expect(cfg.calendarId).toBeUndefined();
    expect(cfg.resendApiKey).toBeUndefined();
    expect(cfg.publicTokenPepper).toBeUndefined();
    expect(cfg.googleServiceAccountFile).toBeUndefined();
    expect(cfg.googleServiceAccountJson).toBeUndefined();
    expect(cfg.spreadsheetId).toBeUndefined();
  });
});
