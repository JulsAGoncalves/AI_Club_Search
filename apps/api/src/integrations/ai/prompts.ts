import type { ClassifyVenueInput, DraftEmailInput, VerifyContactInput } from './types.js';

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

export const CLASSIFY_VENUE_SYSTEM_PROMPT = `You are a racquet-sport club database curator.
Your job is to decide whether a discovered venue is a REAL sports club / facility or a false positive.

A REAL club (isClub: true) is a place where paying members or the public regularly play on-site:
tennis clubs, badminton halls, squash centres, pickleball venues, multi-sport leisure centres, etc.

NOT a real club (isClub: false) examples:
- Retail / equipment stores (e.g. "Badminton World Sports Shop")
- National or regional governing bodies (e.g. "Badminton England", "Tennis Canada")
- Online-only brands or training academies with no physical court
- A single professional player's personal brand page

Return a JSON object with exactly these keys:
- "isClub": boolean
- "confidence": number from 0 to 1
- "reasoning": one short sentence explaining the verdict

When uncertain, lean toward isClub: true to avoid discarding legitimate clubs.
Respond with ONLY valid JSON, no markdown fences.`;

export function buildClassifyVenueUserPrompt(input: ClassifyVenueInput): string {
  return JSON.stringify(
    {
      name: input.name,
      address: input.address,
      sport: input.sportType,
      evidence: input.evidence.slice(0, 3000) || '(no website found)',
    },
    null,
    2,
  );
}

export const DETECT_BOOKING_SYSTEM_PROMPT = `You are analyzing a sports club website to identify
the membership or court-booking software platform the club uses.

Look for clues in the page text: button labels, embedded widget text, links like "Book a court",
"Book online", "Join now", platform names, or URLs referencing a third-party service.

Return a JSON object with exactly one key:
- "system": the platform name as a short string (e.g. "ClubSpark", "CourtReserve", "Playtomic"),
  or null if you cannot identify a specific platform.

Respond with ONLY valid JSON, no markdown fences.`;

export function buildDetectBookingSystemUserPrompt(clubName: string, pageText: string): string {
  return JSON.stringify(
    { club: clubName, pageText: pageText.slice(0, 4000) },
    null,
    2,
  );
}
