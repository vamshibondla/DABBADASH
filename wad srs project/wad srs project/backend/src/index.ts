import { Server } from 'http';
import { createApp } from './app';
import { closeDb } from './db/connection';
import { createSchema } from './db/schema';
import { seedDatabase } from './db/seed';
import { logger } from './logger';
const app = createApp();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const host = process.env.HOST?.trim() || '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

let server: Server;
try {
  createSchema();
  const allowDemoSeed =
    process.env.DABBADASH_DEMO_SEED === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.DABBADASH_DEMO_SEED !== 'false');
  if (allowDemoSeed) seedDatabase();
  server = app.listen(port, host, () => {
    logger.info('DabbaDash API listening.', { event: 'api_server_started', host, port });
  });
} catch (error) {
  closeDb();
  logger.error('Failed to initialize the DabbaDash API.', {
    event: 'api_initialization_failed',
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  throw error;
}

server.on('error', (error) => {
  logger.error('DabbaDash API server failed.', {
    event: 'api_server_error',
    errorType: error.name,
  });
  closeDb();
  process.exitCode = 1;
});

function shutdown(signal: string): void {
  logger.info('API shutdown requested.', { event: 'api_server_stopping', signal });
  server.close((error) => {
    if (error) {
      logger.error('Error while closing the API server.', {
        event: 'api_server_shutdown_failed',
        errorType: error.name,
      });
      process.exitCode = 1;
    }
    closeDb();
    logger.info('API server stopped.', { event: 'api_server_stopped', signal });
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
