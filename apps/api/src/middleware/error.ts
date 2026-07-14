import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/errors.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
}
