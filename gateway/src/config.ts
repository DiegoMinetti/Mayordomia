/**
 * Centralized config loaded from environment variables. Replaces
 * apps-script/Config.gs (which read Script Properties). Required values
 * throw at boot; optional ones return undefined.
 *
 * The Service Account JSON can be provided either via file path
 * (GOOGLE_SERVICE_ACCOUNT_FILE) or inline (GOOGLE_SERVICE_ACCOUNT_JSON).
 * File path is preferred for production (docker secret mount).
 */
import 'dotenv/config';
import { ApiError } from './errors.js';

function optional(name: string, env: NodeJS.ProcessEnv): string | undefined {
  const value = env[name];
  return value && value.trim() !== '' ? value : undefined;
}

function list(name: string, env: NodeJS.ProcessEnv): string[] {
  const raw = env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface Config {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: string;
  allowedOrigins: string[];
  /** Path to the SQLite database file. `:memory:` allowed for tests. */
  dbPath: string;
  /** @deprecated kept during the Sheets→SQLite migration (PR 2); will be removed. */
  spreadsheetId: string | undefined;
  /** @deprecated kept during the Sheets→SQLite migration (PR 2); will be removed. */
  googleServiceAccountFile: string | undefined;
  /** @deprecated kept during the Sheets→SQLite migration (PR 2); will be removed. */
  googleServiceAccountJson: string | undefined;
  calendarId: string | undefined;
  resendApiKey: string | undefined;
  resendFrom: string | undefined;
  publicTokenPepper: string | undefined;
  rateLimit: { windowMs: number; max: number };
}

function parseNodeEnv(value: string | undefined): Config['nodeEnv'] {
  if (value === 'production' || value === 'test') return value;
  return 'development';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const portRaw = env['PORT'] ?? '3000';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw ApiError.internal('CONFIG_MISSING', `PORT inválido: ${portRaw}`);
  }

  const nodeEnv = parseNodeEnv(env['NODE_ENV']);
  const dbPathRaw = env['DB_PATH'];
  const dbPath =
    dbPathRaw && dbPathRaw.trim() !== ''
      ? dbPathRaw
      : nodeEnv === 'test'
        ? ':memory:'
        : `./data/mayordomia-${nodeEnv}.db`;

  return {
    port,
    nodeEnv: parseNodeEnv(env['NODE_ENV']),
    logLevel: env['LOG_LEVEL'] ?? 'info',
    allowedOrigins: list('ALLOWED_ORIGINS', env),
    dbPath,
    spreadsheetId: optional('SPREADSHEET_ID', env),
    googleServiceAccountFile: optional('GOOGLE_SERVICE_ACCOUNT_FILE', env),
    googleServiceAccountJson: optional('GOOGLE_SERVICE_ACCOUNT_JSON', env),
    calendarId: optional('CALENDAR_ID', env),
    resendApiKey: optional('RESEND_API_KEY', env),
    resendFrom: optional('RESEND_FROM', env),
    publicTokenPepper: optional('PUBLIC_TOKEN_PEPPER', env),
    rateLimit: {
      windowMs: Number.parseInt(env['RATE_LIMIT_WINDOW_MS'] ?? '600000', 10),
      max: Number.parseInt(env['RATE_LIMIT_MAX'] ?? '100', 10),
    },
  };
}
