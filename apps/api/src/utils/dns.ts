import { promises as dns } from 'node:dns';

/**
 * Cheap validity pre-check for an email address: does the domain have an
 * MX record (or at least an A record we can fall back to)?
 */
export async function domainResolves(email: string | null | undefined): Promise<boolean> {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) return false;

  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) return true;
  } catch {
    // fall through to A-record check
  }
  try {
    const a = await dns.resolve(domain);
    return a.length > 0;
  } catch {
    return false;
  }
}
