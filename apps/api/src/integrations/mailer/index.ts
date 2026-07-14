import { integrations } from '../../config/env.js';
import { NodemailerMailer, StubMailer } from './nodemailer.js';
import type { Mailer } from './types.js';

let cached: Mailer | null = null;

/** Returns the SMTP mailer when configured, otherwise a logging stub. */
export function getMailer(): Mailer {
  if (!cached) cached = integrations.smtp ? new NodemailerMailer() : new StubMailer();
  return cached;
}

export * from './types.js';
