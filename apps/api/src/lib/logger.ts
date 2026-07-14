/* Minimal structured-ish logger. Swap for pino/winston later if needed. */

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, message: string, meta?: unknown) {
  const time = new Date().toISOString();
  const prefix = `[${time}] ${level.toUpperCase()}`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](prefix, message, meta);
  } else {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](prefix, message);
  }
}

export const logger = {
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
};
