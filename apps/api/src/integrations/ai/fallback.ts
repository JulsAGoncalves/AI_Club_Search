import type {
  AiClient,
  DraftEmailInput,
  DraftEmailResult,
  VerifyContactInput,
  VerifyContactResult,
} from './types.js';

const GENERIC_LOCAL_PARTS = ['info', 'contact', 'admin', 'office', 'hello', 'enquiries', 'reception'];

/**
 * Deterministic, no-API client used when no AI key is configured.
 * Keeps the whole pipeline runnable in development.
 */
export class FallbackAiClient implements AiClient {
  readonly name = 'fallback-heuristic';
  readonly configured = false;

  async verifyContact(input: VerifyContactInput): Promise<VerifyContactResult> {
    if (!input.contactEmail) {
      return { status: 'INVALID', confidence: 0.1, reasoning: 'No email address was found.' };
    }
    if (!input.domainResolves) {
      return {
        status: 'INVALID',
        confidence: 0.15,
        reasoning: 'The email domain does not resolve (no MX/A record).',
      };
    }
    const localPart = input.contactEmail.split('@')[0]?.toLowerCase() ?? '';
    const isGeneric = GENERIC_LOCAL_PARTS.some((g) => localPart.includes(g));
    const hasNameAndRole = !!input.contactName && !!input.contactRole;

    if (hasNameAndRole && !isGeneric) {
      return {
        status: 'VERIFIED',
        confidence: 0.7,
        reasoning: 'Named contact with a management role and a resolving personal-looking email.',
      };
    }
    return {
      status: 'UNCERTAIN',
      confidence: isGeneric ? 0.4 : 0.5,
      reasoning: isGeneric
        ? 'Generic inbox address; recipient may not be the decision maker.'
        : 'Email resolves but the contact role could not be confirmed.',
    };
  }

  async draftEmail(input: DraftEmailInput): Promise<DraftEmailResult> {
    const name = input.contactName?.split(' ')[0] ?? 'there';
    const sport = input.sportType.toLowerCase();
    const demo = input.demoLink ? `\n\nYou can grab a time here: ${input.demoLink}` : '';
    const signOff = input.signOff ?? `Best,\n${input.senderName}`;
    const subject = input.templateSubject?.trim()
      ? renderTemplate(input.templateSubject, input)
      : `Helping ${input.clubName} run ${sport} more smoothly`;
    const body = input.templateBody?.trim()
      ? renderTemplate(input.templateBody, input)
      : `Hi ${name},

I came across ${input.clubName} while looking at ${sport} clubs in the area. I'm building software that handles member management and billing for racquet-sport clubs, and I'd love to show you how it could save your team time on court bookings and payments.

Would you be open to a short live demo?${demo}

${signOff}`;
    return { subject, body };
  }
}

/** Replace [Club name], [Manager name], [Sport type] style placeholders. */
export function renderTemplate(template: string, input: DraftEmailInput): string {
  return template
    .replaceAll('[Club name]', input.clubName)
    .replaceAll('[Manager name]', input.contactName ?? 'there')
    .replaceAll('[Sport type]', input.sportType.toLowerCase())
    .replaceAll('[Demo link]', input.demoLink ?? '')
    .replaceAll('[Sender name]', input.senderName);
}
