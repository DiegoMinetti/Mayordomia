import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { loadConfig, type Config } from './config.js';
import { createLogger, type Logger } from './logging.js';
import { makeRepository, type Repository } from './repository/index.js';
import { makeAuditService, type AuditService } from './audit/service.js';
import { dispatch, register, type DispatchDeps } from './router/index.js';
import { ok, fail } from './envelope.js';
import { ApiException, ApiError } from './errors.js';
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
import { makeAuthRoutes } from './auth/routes.js';
import { setupBootstrap } from './auth/setup.js';
import { SESSION_PREFIX } from './auth/sessions.js';
import { createMagicLink, consumeMagicLink, MAGIC_LINK_TTL_MS } from './auth/magicLink.js';
import {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
} from './auth/passkey.js';
import { setSessionCookie, clearSessionCookie } from './server-shared.js';
import { openDatabase, applyMigrations, defaultMigrationsDir, type Db } from './db/index.js';

export interface ServerDeps {
  config: Config;
  logger: Logger;
  repo: Repository;
  audit: AuditService;
  /**
   * Optional SQLite handle. PR 2 will make this required and rewire all
   * handlers; PR 1 keeps it optional so existing tests that build the app
   * directly continue to work.
   */
  db?: Db;
}

export function buildApp(deps: ServerDeps): Express {
  const { config, logger, repo, audit, db } = deps;
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
  const catalog = makeCatalogHandlers({ repo });
  const health = makeHealthHandlers({ repo, config, ...(db ? { db } : {}) });
  const requests = makeRequestsHandlers({ repo, audit });
  const resources = makeResourcesHandlers({ repo });
  const events = makeEventsHandlers({ repo });
  const operations = makeOperationsHandlers({ repo });
  const maintenance = makeMaintenanceHandlers({ repo });
  const purchases = makePurchasesHandlers({ repo });
  const notifications = makeNotificationsHandlers({ repo });
  const rateLimit = makeRateLimiter(config.rateLimit);
  const dispatchDeps: DispatchDeps = { repo, audit };

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
      repo,
      audit,
      publicTokenPepper: config.publicTokenPepper,
      rateLimit,
    });
    register('requests.createPublic', {}, (payload, ctx) => publicRequests.create(payload, ctx));
    logger.info('registered requests.createPublic (pepper configured)');
  } else {
    logger.warn('PUBLIC_TOKEN_PEPPER not set — requests.createPublic route disabled');
  }

  // PR 3 — Local auth endpoints. These bypass the dispatcher because they
  // don't have an organizationId yet (register/login bootstrap the tenant).
  const auth = makeAuthRoutes({ repo });
  app.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await auth.register({
        ...body,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      setSessionCookie(res, result['token'] as string);
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });
  app.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await auth.login({
        ...body,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      setSessionCookie(res, result['token'] as string);
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });
  app.post('/auth/logout', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const result = await auth.logout(extractSessionToken(req));
      clearSessionCookie(res);
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });
  app.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const result = await auth.refresh(extractSessionToken(req));
      setSessionCookie(res, result['token'] as string);
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });
  app.post('/auth/me', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const result = await auth.me(extractSessionToken(req));
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });

  // PR 7 — Bootstrap endpoint. Idempotent first-run setup. Creates the org
  // + first super-admin user in one call. Refuses if the email already exists
  // under a different org, or if the orgId exists without this email as
  // admin. Sets the session cookie on success.
  app.post('/auth/setup', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await setupBootstrap(
        repo,
        {
          email: String(body['email'] ?? ''),
          password: String(body['password'] ?? ''),
          name: String(body['name'] ?? ''),
          organizationId:
            typeof body['organizationId'] === 'string' ? body['organizationId'] : undefined,
          organizationName:
            typeof body['organizationName'] === 'string' ? body['organizationName'] : undefined,
          timezone: typeof body['timezone'] === 'string' ? body['timezone'] : undefined,
        },
        res,
      );
      res.json(ok(result, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });

  // PR 5 — Magic-link sign-in.
  // In production: SMTP is configured via RESEND_API_KEY/RESEND_FROM and
  // sends the link to the user. In dev: link is logged + returned in the
  // response so the developer can click it from the dialog.
  const publicBaseUrl = process.env['PUBLIC_BASE_URL'] ?? '';
  const magicLinkSend = makeMagicLinkSender(config.resendApiKey, config.resendFrom, logger);
  app.post('/auth/magic-link', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createMagicLink(
        repo,
        {
          email: String(body['email'] ?? ''),
          organizationId: String(body['organizationId'] ?? ''),
        },
        magicLinkSend,
        publicBaseUrl,
      );
      const data: Record<string, unknown> = {
        expiresAt: result.expiresAt,
        ttlMs: MAGIC_LINK_TTL_MS,
      };
      if (!config.resendApiKey && result.token) {
        // Dev convenience: include the link so the dialog can navigate.
        data['devLink'] =
          `${publicBaseUrl || req.headers.origin || ''}/auth/magic-link/verify?token=${encodeURIComponent(result.token)}`;
        data['token'] = result.token;
      }
      res.json(ok(data, requestId));
    } catch (error) {
      next({ requestId, error });
    }
  });
  app.post('/auth/magic-link/verify', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const queryToken = typeof req.query['token'] === 'string' ? req.query['token'] : undefined;
      const token = String(body['token'] ?? queryToken ?? '');
      const consumed = await consumeMagicLink(repo, { token });
      const { createSession } = await import('./auth/sessions.js');
      const { token: sessionToken, session } = await createSession(repo, {
        userId: consumed.userId,
        organizationId: consumed.organizationId,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? String(req.headers['user-agent'])
            : undefined,
        ip: typeof req.ip === 'string' ? req.ip : undefined,
      });
      setSessionCookie(res, sessionToken);
      res.json(
        ok(
          {
            token: sessionToken,
            expiresAt: session.expiresAt,
            userId: consumed.userId,
            organizationId: consumed.organizationId,
          },
          requestId,
        ),
      );
    } catch (error) {
      next({ requestId, error });
    }
  });

  // PR 6 — Passkey (WebAuthn).
  app.post(
    '/auth/passkey/register/options',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestId = randomUUID();
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const token = extractSessionToken(req);
        const { verifyIdentity } = await import('./auth/service.js');
        const identity = await verifyIdentity(repo, token ? { sessionToken: token } : undefined);
        const organizationId = String(body['organizationId'] ?? '');
        if (!organizationId) throw ApiError.badRequest('VALIDATION_ERROR', 'Falta organizationId');
        const options = await startRegistration(repo, { userId: identity.sub, organizationId });
        res.json(ok(options, requestId));
      } catch (error) {
        next({ requestId, error });
      }
    },
  );
  app.post(
    '/auth/passkey/register/verify',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestId = randomUUID();
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const token = extractSessionToken(req);
        const { verifyIdentity } = await import('./auth/service.js');
        const identity = await verifyIdentity(repo, token ? { sessionToken: token } : undefined);
        const organizationId = String(body['organizationId'] ?? '');
        const result = await finishRegistration(repo, {
          userId: identity.sub,
          organizationId,
          response: body['response'] as never,
        });
        res.json(ok(result, requestId));
      } catch (error) {
        next({ requestId, error });
      }
    },
  );
  app.post(
    '/auth/passkey/login/options',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestId = randomUUID();
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const organizationId = String(body['organizationId'] ?? '');
        if (!organizationId) throw ApiError.badRequest('VALIDATION_ERROR', 'Falta organizationId');
        const options = await startAuthentication(repo, organizationId);
        res.json(ok(options, requestId));
      } catch (error) {
        next({ requestId, error });
      }
    },
  );
  app.post(
    '/auth/passkey/login/verify',
    async (req: Request, res: Response, next: NextFunction) => {
      const requestId = randomUUID();
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const organizationId = String(body['organizationId'] ?? '');
        const result = await finishAuthentication(
          repo,
          { organizationId, response: body['response'] as never },
          res,
        );
        res.json(ok(result, requestId));
      } catch (error) {
        next({ requestId, error });
      }
    },
  );

  // Single action endpoint. Mirrors Apps Script doPost() contract.
  app.post('/api', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    req.log = req.log ?? logger;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sessionToken = extractSessionToken(req);
      const result = await dispatch(
        { ...body, requestId, auth: sessionToken ? { sessionToken } : undefined } as Parameters<
          typeof dispatch
        >[0] & {
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
  repo: Repository;
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
  // PR 3: SQLite is the only store. No Google deps.
  const repo = makeRepository(db);
  const audit = makeAuditService(repo, logger);
  const app = buildApp({ config, logger, repo, audit, db });
  return { app, config, logger, repo, db };
}

// --- Helpers for session cookie handling ---------------------------------

function extractSessionToken(req: Request): string | undefined {
  // 1. Authorization: Bearer sess_…
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ') && auth.slice(7).startsWith(SESSION_PREFIX)) {
    return auth.slice(7);
  }
  // 2. Cookie
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const match = /(?:^|;\s*)mayordomia_session=([^;]+)/.exec(cookieHeader);
    if (match && match[1] && match[1].startsWith(SESSION_PREFIX)) {
      return decodeURIComponent(match[1]);
    }
  }
  return undefined;
}

function makeMagicLinkSender(
  resendApiKey: string | undefined,
  resendFrom: string | undefined,
  logger: Logger,
): import('./auth/magicLink.js').SendMagicLink {
  if (!resendApiKey || !resendFrom) {
    return async (args) => {
      logger.info(
        { to: args.to, subject: args.subject },
        '[magic-link] SMTP not configured — link is in response',
      );
    };
  }
  return async (args) => {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: resendFrom,
          to: args.to,
          subject: args.subject,
          text: args.text,
          html: args.html,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        logger.error({ status: res.status, body }, '[magic-link] resend send failed');
        throw new Error(`resend returned ${res.status}`);
      }
    } catch (err) {
      logger.error({ err, to: args.to }, '[magic-link] resend send threw');
      throw err;
    }
  };
}
