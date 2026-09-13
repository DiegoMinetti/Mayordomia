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
import { makeRequestsHandlers } from './requests/handlers.js';
import { makePublicRequestsHandlers, makeRateLimiter } from './requests/public.js';
import { makeResourcesHandlers } from './resources/handlers.js';
import { makeEventsHandlers } from './events/handlers.js';
import { makeOperationsHandlers } from './operations/handlers.js';
import { makeMaintenanceHandlers } from './maintenance/handlers.js';
import { makePurchasesHandlers } from './purchases/handlers.js';
import { makeNotificationsHandlers } from './notifications/handlers.js';
import { openDatabase, applyMigrations, defaultMigrationsDir, type Db } from './db/index.js';

export interface ServerDeps {
  config: Config;
  logger: Logger;
  sheets: SheetsClient;
  audit: AuditService;
  /**
   * Optional SQLite handle. PR 2 will make this required and rewire all
   * handlers; PR 1 keeps it optional so existing tests that build the app
   * directly continue to work.
   */
  db?: Db;
}

export function buildApp(deps: ServerDeps): Express {
  const { config, logger, sheets, audit, db } = deps;
  const app = express();

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req: Request, res: Response, err?: Error) =>
        err || res.statusCode >= 500 ? 'error' : 'info',
    }),
  );

  const corsOptions =
    config.allowedOrigins.length === 0
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
    res.json({
      ok: true,
      data: { service: 'mayordomia-gateway', status: 'OK' },
      error: null,
      meta: { requestId: 'ping' },
    });
  });

  // Register all routes that exist in this build.
  const catalog = makeCatalogHandlers({ sheets });
  const health = makeHealthHandlers({ sheets, config, ...(db ? { db } : {}) });
  const requests = makeRequestsHandlers({ sheets, audit });
  const resources = makeResourcesHandlers({ sheets });
  const events = makeEventsHandlers({ sheets });
  const operations = makeOperationsHandlers({ sheets });
  const maintenance = makeMaintenanceHandlers({ sheets });
  const purchases = makePurchasesHandlers({ sheets });
  const notifications = makeNotificationsHandlers({ sheets });
  const rateLimit = makeRateLimiter(config.rateLimit);
  const dispatchDeps: DispatchDeps = { sheets, audit };

  register('system.health', { auth: true, permission: 'config.manage' }, (payload, ctx) =>
    health.check(payload, ctx),
  );
  register('catalog.organization', { auth: true }, (payload, ctx) =>
    catalog.organization(payload, ctx),
  );
  register('catalog.listOrganizations', { auth: true }, (payload, ctx) =>
    catalog.listOrganizations(payload, ctx),
  );
  register('catalog.listSites', { auth: true }, (payload, ctx) => catalog.listSites(payload, ctx));
  register('catalog.listUsers', { auth: true }, (payload, ctx) => catalog.listUsers(payload, ctx));
  register('catalog.listRoles', { auth: true }, (payload, ctx) => catalog.listRoles(payload, ctx));

  // PR 3 — Resources (read-only).
  register('resources.list', { auth: true, permission: 'resource.review' }, (payload, ctx) =>
    resources.list(payload, ctx),
  );
  register('resources.get', { auth: true, permission: 'resource.review' }, (payload, ctx) =>
    resources.get(payload, ctx),
  );
  register(
    'resources.listLocations',
    { auth: true, permission: 'resource.review' },
    (payload, ctx) => resources.listLocations(payload, ctx),
  );
  register('resources.getLocation', { auth: true, permission: 'resource.review' }, (payload, ctx) =>
    resources.getLocation(payload, ctx),
  );

  // PR 3 — Events (read-only).
  register('events.list', { auth: true, permission: 'event.review' }, (payload, ctx) =>
    events.list(payload, ctx),
  );
  register('events.get', { auth: true, permission: 'event.review' }, (payload, ctx) =>
    events.get(payload, ctx),
  );
  register('events.upcoming', { auth: true, permission: 'event.review' }, (payload, ctx) =>
    events.upcoming(payload, ctx),
  );

  // PR 4 — Operations, Maintenance, Purchases, Notifications (read-only).
  register('operations.list', { auth: true, permission: 'delivery.manage' }, (p, ctx) =>
    operations.list(p, ctx),
  );
  register('operations.get', { auth: true, permission: 'delivery.manage' }, (p, ctx) =>
    operations.get(p, ctx),
  );
  register('maintenance.list', { auth: true, permission: 'maintenance.manage' }, (p, ctx) =>
    maintenance.list(p, ctx),
  );
  register('maintenance.get', { auth: true, permission: 'maintenance.manage' }, (p, ctx) =>
    maintenance.get(p, ctx),
  );
  register('purchases.listSuppliers', { auth: true, permission: 'purchase.manage' }, (p, ctx) =>
    purchases.listSuppliers(p, ctx),
  );
  register('purchases.listRequests', { auth: true, permission: 'purchase.manage' }, (p, ctx) =>
    purchases.listRequests(p, ctx),
  );
  register('purchases.getRequest', { auth: true, permission: 'purchase.manage' }, (p, ctx) =>
    purchases.getRequest(p, ctx),
  );
  register('purchases.listQuotes', { auth: true, permission: 'purchase.manage' }, (p, ctx) =>
    purchases.listQuotes(p, ctx),
  );
  register('notifications.listMine', { auth: true }, (p, ctx) => notifications.listMine(p, ctx));
  register('notifications.unreadCount', { auth: true }, (p, ctx) =>
    notifications.unreadCount(p, ctx),
  );

  // PR 2 — Requests module.
  register('requests.list', { auth: true, permission: 'request.review' }, (payload, ctx) =>
    requests.list(payload, ctx),
  );
  register('requests.get', { auth: true, permission: 'request.review' }, (payload, ctx) =>
    requests.get(payload, ctx),
  );
  register('requests.approve', { auth: true, audit: true }, (payload, ctx) =>
    requests.approve(payload, ctx),
  );
  register('requests.reject', { auth: true, audit: true }, (payload, ctx) =>
    requests.reject(payload, ctx),
  );

  // requests.createPublic needs PUBLIC_TOKEN_PEPPER; skip the route when absent.
  if (config.publicTokenPepper) {
    const publicRequests = makePublicRequestsHandlers({
      sheets,
      audit,
      publicTokenPepper: config.publicTokenPepper,
      rateLimit,
    });
    register('requests.createPublic', {}, (payload, ctx) => publicRequests.create(payload, ctx));
    logger.info('registered requests.createPublic (pepper configured)');
  } else {
    logger.warn('PUBLIC_TOKEN_PEPPER not set — requests.createPublic route disabled');
  }

  // Single action endpoint. Mirrors Apps Script doPost() contract.
  app.post('/api', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    req.log = req.log ?? logger;
    try {
      const result = await dispatch(
        { ...(req.body as object), requestId } as Parameters<typeof dispatch>[0] & {
          requestId: string;
        },
        dispatchDeps,
      );
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });

  // Centralized error → envelope mapping.
  app.use(
    (
      err: { requestId?: string; error?: unknown } & Error,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ): void => {
      void _next; // Express requires the 4-arg signature for error middleware
      const requestId = err.requestId ?? randomUUID();
      const inner = (err as { error?: unknown }).error ?? err;
      if (inner instanceof ApiException) {
        logger.warn({ requestId, code: inner.code, message: inner.message }, 'api error');
        res
          .status(200)
          .json(fail(inner.code, inner.message, requestId, inner.details, inner.status));
      } else {
        logger.error({ requestId, err: inner }, 'unexpected error');
        res
          .status(200)
          .json(fail('INTERNAL_ERROR', 'Ocurrió un error inesperado', requestId, null, 500));
      }
    },
  );

  return app;
}

export async function createServer(): Promise<{
  app: Express;
  config: Config;
  logger: Logger;
  sheets: SheetsClient;
  db: Db;
}> {
  const config = loadConfig();
  const logger = createLogger(config);
  const db = openDatabase({ path: config.dbPath });
  const migrationResult = applyMigrations(db, defaultMigrationsDir());
  if (migrationResult.applied.length > 0) {
    logger.info(
      {
        applied: migrationResult.applied.map((m) => `${m.version}-${m.name}`),
        total: migrationResult.total,
      },
      'sqlite migrations applied',
    );
  } else {
    logger.info({ total: migrationResult.total }, 'sqlite migrations up to date');
  }
  // Sheets is deprecated during the Sheets→SQLite migration (PR 1 → PR 2). If
  // SPREADSHEET_ID is unset, we skip Sheets entirely: the existing PR-merged
  // handlers will fail loudly at runtime when they try to read, but the boot
  // succeeds and SQLite + health work. Once PR 2 rewrites the handlers, the
  // Sheets code path goes away.
  const sheets = config.spreadsheetId
    ? await createSheetsClient(config, logger)
    : (logger.warn(
        { reason: 'SPREADSHEET_ID not set' },
        'sheets client disabled — handlers will fail until PR 2',
      ),
      {
        raw: {} as never,
        spreadsheetId: '',
        rows: async () => {
          throw new Error(
            'Sheets client disabled (PR 1 transition): set SPREADSHEET_ID or wait for PR 2',
          );
        },
        findOne: async () => {
          throw new Error('Sheets client disabled (PR 1 transition)');
        },
        append: async () => {
          throw new Error('Sheets client disabled (PR 1 transition)');
        },
        updateWhere: async () => {
          throw new Error('Sheets client disabled (PR 1 transition)');
        },
        close: () => undefined,
      } satisfies SheetsClient);
  const audit = makeAuditService(sheets, logger);
  const app = buildApp({ config, logger, sheets, audit, db });
  return { app, config, logger, sheets, db };
}
