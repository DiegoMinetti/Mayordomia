/**
 * Express server. Wires up logging, CORS, JSON body parsing, health probes,
 * and the single POST /api endpoint that mirrors the Apps Script doPost()
 * contract. Everything else (auth/RBAC/router) is delegated to modules.
 */
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { loadConfig, type Config } from './config.js';
import { createLogger, type Logger } from './logging.js';
import { createSheetsClient, type SheetsClient } from './sheets/client.js';
import { makeAuditService, type AuditService } from './audit/service.js';
import { dispatch, register, type DispatchDeps } from './router/index.js';
import { ok, fail } from './envelope.js';
import { ApiException } from './errors.js';
import { makeCatalogHandlers } from './routes/catalog.js';
import { makeHealthHandlers } from './routes/health.js';

export interface ServerDeps {
  config: Config;
  logger: Logger;
  sheets: SheetsClient;
  audit: AuditService;
}

export function buildApp(deps: ServerDeps): Express {
  const { config, logger, sheets, audit } = deps;
  const app = express();

  app.use(pinoHttp({ logger, customLogLevel: (_req: Request, res: Response, err?: Error) => (err || res.statusCode >= 500 ? 'error' : 'info') }));

  const corsOptions = config.allowedOrigins.length === 0
    ? undefined
    : {
        origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
          // Allow requests with no Origin (curl, server-to-server).
          if (!origin) return cb(null, true);
          if (config.allowedOrigins.includes(origin)) return cb(null, true);
          return cb(new Error('Origin not allowed'));
        },
        credentials: true,
      };
  app.use(cors(corsOptions));

  app.use(express.json({ limit: '256kb' }));

  // Liveness probe — no data, no auth, no DB.
  app.get('/ping', (_req, res) => {
    res.json({ ok: true, data: { service: 'mayordomia-gateway', status: 'OK' }, error: null, meta: { requestId: 'ping' } });
  });

  // Register all routes that exist in this build.
  const catalog = makeCatalogHandlers({ sheets });
  const health = makeHealthHandlers({ sheets, config });
  const dispatchDeps: DispatchDeps = { sheets, audit };

  register('system.health', { auth: true, permission: 'config.manage' }, (payload, ctx) =>
    health.check(payload, ctx),
  );
  register('catalog.organization', { auth: true }, (payload, ctx) => catalog.organization(payload, ctx));
  register('catalog.listOrganizations', { auth: true }, (payload, ctx) => catalog.listOrganizations(payload, ctx));
  register('catalog.listSites', { auth: true }, (payload, ctx) => catalog.listSites(payload, ctx));
  register('catalog.listUsers', { auth: true }, (payload, ctx) => catalog.listUsers(payload, ctx));
  register('catalog.listRoles', { auth: true }, (payload, ctx) => catalog.listRoles(payload, ctx));

  // Single action endpoint. Mirrors Apps Script doPost() contract.
  app.post('/api', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    req.log = req.log ?? logger;
    try {
      const result = await dispatch({ ...(req.body as object), requestId } as Parameters<typeof dispatch>[0] & { requestId: string }, dispatchDeps);
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });

  // Centralized error → envelope mapping.
  app.use((err: { requestId?: string; error?: unknown } & Error, _req: Request, res: Response, _next: NextFunction): void => {
    void _next; // Express requires the 4-arg signature for error middleware
    const requestId = err.requestId ?? randomUUID();
    const inner = (err as { error?: unknown }).error ?? err;
    if (inner instanceof ApiException) {
      logger.warn({ requestId, code: inner.code, message: inner.message }, 'api error');
      res.status(200).json(fail(inner.code, inner.message, requestId, inner.details, inner.status));
    } else {
      logger.error({ requestId, err: inner }, 'unexpected error');
      res.status(200).json(fail('INTERNAL_ERROR', 'Ocurrió un error inesperado', requestId, null, 500));
    }
  });

  return app;
}

export async function createServer(): Promise<{ app: Express; config: Config; logger: Logger; sheets: SheetsClient }> {
  const config = loadConfig();
  const logger = createLogger(config);
  const sheets = await createSheetsClient(config, logger);
  const audit = makeAuditService(sheets, logger);
  const app = buildApp({ config, logger, sheets, audit });
  return { app, config, logger, sheets };
}
