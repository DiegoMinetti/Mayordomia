/**
 * Entry point. Boots the server and handles graceful shutdown.
 */
import { createServer } from './server.js';
import { ApiException } from './errors.js';

async function main(): Promise<void> {
  try {
    const { app, config, logger } = await createServer();
    const server = app.listen(config.port, () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'mayordomia-gateway listening');
    });

    const shutdown = (signal: NodeJS.Signals): void => {
      logger.info({ signal }, 'shutting down');
      server.close((err) => {
        if (err) {
          logger.error({ err }, 'shutdown error');
          process.exit(1);
        }
        process.exit(0);
      });
      // Hard exit if graceful close hangs.
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    if (error instanceof ApiException) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ code: error.code, message: error.message, status: error.status }));
      process.exit(error.status >= 500 ? 1 : 2);
    }
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  }
}

void main();
