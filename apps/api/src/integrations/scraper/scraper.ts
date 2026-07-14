import * as cheerio from 'cheerio';
import { logger } from '../../lib/logger.js';
import { detectMembershipSystem } from './membership-detector.js';

export interface ScrapeResult {
  emails: string[];
  /** Condensed text used as evidence for the AI verification step. */
  evidence: string;
  /** Domain extracted from the website URL, if any. */
  domain: string | null;
  /** Detected membership/billing platform (e.g. "ClubSpark"), or null. */
  membershipSystem: string | null;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CANDIDATE_PATHS = ['', '/contact', '/contact-us', '/about', '/about-us', '/staff', '/team'];
const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGES = 4;

function normalizeUrl(website: string): URL | null {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`);
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CourtReachBot/0.1 (+contact discovery)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort scrape of a club website to surface contact emails and evidence text. */
export async function scrapeWebsite(website: string | null | undefined): Promise<ScrapeResult> {
  const empty: ScrapeResult = { emails: [], evidence: '', domain: null, membershipSystem: null };
  if (!website) return empty;

  const base = normalizeUrl(website);
  if (!base) return empty;

  const emails = new Set<string>();
  const evidenceParts: string[] = [];
  let pagesFetched = 0;
  let membershipSystem: string | null = null;

  for (const path of CANDIDATE_PATHS) {
    if (pagesFetched >= MAX_PAGES) break;
    const target = new URL(path, base).toString();
    const html = await fetchText(target);
    if (!html) continue;
    pagesFetched += 1;

    // Detect the membership/billing platform from the raw HTML, before scripts
    // and iframes are stripped (many providers are embedded via <script>/<iframe>).
    if (!membershipSystem) {
      membershipSystem = detectMembershipSystem(html);
    }

    const $ = cheerio.load(html);
    $('script, style, noscript').remove();

    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const addr = href.replace(/^mailto:/i, '').split('?')[0]?.trim();
      if (addr) emails.add(addr.toLowerCase());
    });

    const text = $('body').text().replace(/\s+/g, ' ').trim();
    for (const match of text.matchAll(EMAIL_REGEX)) emails.add(match[0].toLowerCase());

    // Keep a small slice of about/contact text as evidence for the AI.
    if (path.includes('about') || path.includes('contact') || path.includes('team') || path === '') {
      evidenceParts.push(text.slice(0, 1200));
    }
  }

  logger.debug(
    `Scraped ${pagesFetched} pages from ${base.hostname}, ${emails.size} emails` +
      (membershipSystem ? `, membership: ${membershipSystem}` : ''),
  );
  return {
    emails: [...emails].filter((e) => !e.endsWith('.png') && !e.endsWith('.jpg')),
    evidence: evidenceParts.join('\n---\n').slice(0, 4000),
    domain: base.hostname.replace(/^www\./, ''),
    membershipSystem,
  };
}
