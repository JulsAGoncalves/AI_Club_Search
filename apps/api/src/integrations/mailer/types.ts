export interface SendEmailInput {
  to: string;
  subject: string;
  /** Plain-text body. */
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  /** True when actually delivered via SMTP; false for the dev stub. */
  delivered: boolean;
}

export interface Mailer {
  readonly name: string;
  readonly configured: boolean;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
