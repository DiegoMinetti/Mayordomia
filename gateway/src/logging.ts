/**
 * Structured logging via pino. Replaces console.log/console.error scattered
 * through the Apps Script code. Pretty-prints in dev, JSON in prod.
 */
import pino, { type Logger } from 'pino';
import type { Config } from './config.js';

export function createLogger(config: Config): Logger {
  if (config.nodeEnv === 'development') {
    return pino({
      level: config.logLevel,
      transport: {
        target: 'pino/file',
        options: { destination: 1 },
      },
    });
  }
  return pino({ level: config.logLevel });
}

export type { Logger };
