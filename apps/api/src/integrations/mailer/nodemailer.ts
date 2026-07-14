import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { Mailer, SendEmailInput, SendEmailResult } from './types.js';

export class NodemailerMailer implements Mailer {
  readonly name = 'nodemailer-smtp';
  readonly configured = true;
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const info = await this.transporter.sendMail({
      from: { name: env.SMTP_FROM_NAME, address: env.SMTP_FROM_EMAIL! },
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return { messageId: info.messageId, delivered: true };
  }
}

/** Logs the email instead of sending. Lets the pipeline run without SMTP. */
export class StubMailer implements Mailer {
  readonly name = 'stub-logger';
  readonly configured = false;

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const messageId = `<stub-${randomUUID()}@courtreach.local>`;
    logger.info('[StubMailer] would send email', {
      to: input.to,
      subject: input.subject,
      messageId,
    });
    return { messageId, delivered: false };
  }
}
