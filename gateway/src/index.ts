/**
 * Entry point. Boots the server and handles graceful shutdown.
 */
import { createServer } from './server.js';
import { closeDatabase } from './db/index.js';
import { ApiException } from './errors.js';

async function main(): Promise<void> {
  try {
    const { app, config, logger, db } = await createServer();
    const server = app.listen(config.port, () => {
      logger.info(
        { port: config.port, env: config.nodeEnv, dbPath: config.dbPath },
        'mayordomia-gateway listening',
      );
    });

    const shutdown = (signal: NodeJS.Signals): void => {
      logger.info({ signal }, 'shutting down');
      let exitCode = 0;
      server.close((err) => {
        if (err) {
          logger.error({ err }, 'http server close error');
          exitCode = 1;
        }
        try {
          closeDatabase(db);
        } catch (err) {
          logger.error({ err }, 'sqlite close error');
          exitCode = 1;
        }
        process.exit(exitCode);
      });
      // Hard exit if graceful close hangs.
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    if (error instanceof ApiException) {
      console.error(
        JSON.stringify({ code: error.code, message: error.message, status: error.status }),
      );
      process.exit(error.status >= 500 ? 1 : 2);
    }
    console.error(error);
    process.exit(1);
  }
}

void main();
