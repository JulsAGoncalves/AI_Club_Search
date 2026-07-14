import { appendFileSync } from 'fs';
import { logger } from '../../lib/logger.js';
import type { ContactCandidate, ContactFinder } from './types.js';
// #region agent log
function dbgLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  try { appendFileSync('debug-8c511f.log', JSON.stringify({sessionId:'8c511f',hypothesisId,location,message,data,timestamp:Date.now()})+'\n'); } catch {}
}
// #endregion

interface HunterEmail {
  value: string;
  type?: string;
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  phone_number?: string | null;
  linkedin?: string | null;
}

interface HunterResponse {
  data?: { emails?: HunterEmail[] };
  errors?: { details?: string }[];
}

/** Prefer management-sounding roles when ranking candidates. */
const ROLE_PRIORITY = ['owner', 'director', 'manager', 'general', 'head', 'pro', 'president'];

function roleScore(position?: string | null): number {
  if (!position) return 0;
  const p = position.toLowerCase();
  const idx = ROLE_PRIORITY.findIndex((r) => p.includes(r));
  return idx === -1 ? 0 : ROLE_PRIORITY.length - idx;
}

export class HunterContactFinder implements ContactFinder {
  readonly name = 'hunter';
  readonly configured = true;

  constructor(private apiKey: string) {}

  async findByDomain(domain: string, _clubName: string): Promise<ContactCandidate[]> {
    const url = new URL('https://api.hunter.io/v2/domain-search');
    url.searchParams.set('domain', domain);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('limit', '10');

    // #region agent log
    const _t0 = Date.now();
    // #endregion
    const res = await fetch(url);
    // #region agent log
    dbgLog('H-A,H-D','hunter.ts:fetch-response','Hunter HTTP response received',{domain,status:res.status,ok:res.ok,durationMs:Date.now()-_t0});
    // #endregion
    const json = (await res.json()) as HunterResponse;

    if (!res.ok) {
      // #region agent log
      dbgLog('H-D','hunter.ts:fetch-error','Hunter returned non-ok status',{domain,status:res.status,errors:JSON.stringify(json.errors)});
      // #endregion
      logger.warn('Hunter domain-search error', json.errors);
      return [];
    }

    const emails = json.data?.emails ?? [];
    const candidates: ContactCandidate[] = emails.map((e) => ({
      name: [e.first_name, e.last_name].filter(Boolean).join(' ') || null,
      role: e.position ?? null,
      email: e.value.toLowerCase(),
      phone: e.phone_number ?? null,
      linkedinUrl: e.linkedin ?? null,
      confidence: typeof e.confidence === 'number' ? e.confidence / 100 : null,
      source: this.name,
    }));

    // Rank by management role first, then provider confidence.
    candidates.sort((a, b) => {
      const r = roleScore(b.role) - roleScore(a.role);
      if (r !== 0) return r;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    return candidates;
  }
}
