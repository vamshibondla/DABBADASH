import { randomUUID } from 'crypto';
import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';
import { ApiError } from './apiError';
import { getDb } from './db/connection';
import { hasDemoSeedData } from './db/seed';
import { logger } from './logger';
import { openApiSpec } from './openapi';
import { apiRouter } from './routes/api';

const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function createApp(): express.Express {
  const configuredOrigins = process.env.CORS_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins?.length ? configuredOrigins : defaultOrigins;
  const app = express();

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    try {
      getDb().prepare('SELECT 1').get();
      res.status(200).json({
        status: 'ok',
        database: 'connected',
        demoData: hasDemoSeedData(),
      });
    } catch {
      logger.error('Health check could not reach the database.', { event: 'health_check_failed' });
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.get('/api/openapi.json', (_req, res) => {
    res.status(200).json(openApiSpec);
  });

  app.use('/api', apiRouter);
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);

    let status = error instanceof ApiError ? error.statusCode : 500;
    const errorType =
      typeof error === 'object' && error !== null && 'type' in error
        ? error.type
        : undefined;
    if (errorType === 'entity.parse.failed') status = 400;
    else if (errorType === 'entity.too.large') status = 413;
    else if (
      !(error instanceof ApiError) &&
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number' &&
      error.status >= 400 &&
      error.status < 600
    ) {
      status = error.status;
    }

    const code =
      error instanceof ApiError
        ? error.code
        : errorType === 'entity.parse.failed'
          ? 'INVALID_JSON'
          : errorType === 'entity.too.large'
            ? 'PAYLOAD_TOO_LARGE'
            : status < 500
              ? 'INVALID_REQUEST'
              : 'INTERNAL_SERVER_ERROR';
    const message =
      error instanceof ApiError
        ? error.message
        : errorType === 'entity.parse.failed'
          ? 'Malformed JSON request body.'
          : errorType === 'entity.too.large'
            ? 'Request body exceeds the 1 MB limit.'
            : status < 500
              ? 'Invalid request.'
              : 'Internal server error.';

    logger[status >= 500 ? 'error' : 'warn']('API request failed.', {
      event: 'api_request_failed',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: status,
      code,
    });
    res.status(status).json({ error: { code, message } });
  };

  app.use(errorHandler);
  return app;
}
