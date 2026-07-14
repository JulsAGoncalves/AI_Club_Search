// Allow self-signed / corporate-proxy certs in development.
// Must be set before any TLS connections are made.
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.API_PORT, () => {
  logger.info(`CourtReach API listening on http://localhost:${env.API_PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

export { app };
