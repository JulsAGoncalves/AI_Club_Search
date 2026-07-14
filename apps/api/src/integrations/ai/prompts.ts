import type { DraftEmailInput, VerifyContactInput } from './types.js';

export const VERIFY_SYSTEM_PROMPT = `You are a meticulous B2B contact verification analyst.
You are given a racquet-sport club and a candidate contact person who may manage the club's courts.
Decide whether the contact's email is the RIGHT person to receive a sales email about club/court
management software.

Return a JSON object with exactly these keys:
- "status": one of "VERIFIED", "UNCERTAIN", "INVALID"
- "confidence": a number from 0 to 1
- "reasoning": one or two short sentences a teammate can read

Guidance:
- "VERIFIED": strong evidence the name/email belongs to a real manager/owner/head pro of THIS club.
- "UNCERTAIN": plausible but unproven (e.g. a generic info@ address, or name without role match).
- "INVALID": the domain does not resolve, the email is clearly wrong, or evidence contradicts it.`;

export function buildVerifyUserPrompt(input: VerifyContactInput): string {
  return JSON.stringify(
    {
      club: { name: input.clubName, website: input.clubWebsite, sport: input.sportType },
      contact: {
        name: input.contactName,
        role: input.contactRole,
        email: input.contactEmail,
      },
      signals: {
        emailDomainResolves: input.domainResolves,
        evidence: input.evidence?.slice(0, 4000) ?? null,
      },
    },
    null,
    2,
  );
}

export const DRAFT_SYSTEM_PROMPT = `You write concise, warm, non-spammy B2B outreach emails.
The sender builds software for racquet-sport clubs: member management plus a full billing system,
and wants to book a short live demo. Personalize to the specific club and sport. Keep it under
150 words. Avoid hype and exclamation marks. End with a clear call to action to book a demo.

Return a JSON object with exactly these keys: "subject" and "body".
If a template is provided, adapt it, filling placeholders like [Club name], [Manager name],
[Sport type] with the real values.`;

export function buildDraftUserPrompt(input: DraftEmailInput): string {
  return JSON.stringify(
    {
      club: { name: input.clubName, sport: input.sportType },
      recipient: { name: input.contactName, role: input.contactRole },
      sender: { name: input.senderName },
      template: {
        subject: input.templateSubject ?? null,
        body: input.templateBody ?? null,
        demoLink: input.demoLink ?? null,
        signOff: input.signOff ?? null,
      },
    },
    null,
    2,
  );
}
