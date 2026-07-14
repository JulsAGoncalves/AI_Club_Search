import type { ClubStatus, VerificationStatus } from '@courtreach/shared';

export const CLUB_STATUS_LABELS: Record<ClubStatus, string> = {
  IMPORTED: 'Imported',
  DISCOVERED: 'Discovered',
  CONTACT_FOUND: 'Contact found',
  VERIFIED: 'Verified',
  UNCERTAIN: 'Uncertain',
  INVALID: 'Invalid',
  OUT_OF_AREA: 'Out of area',
  EMAIL_SENT: 'Email sent',
  REPLIED: 'Replied',
  DEMO_BOOKED: 'Demo booked',
  SKIPPED: 'Skipped',
};

/** Ordered columns for the pipeline board. */
export const PIPELINE_ORDER: ClubStatus[] = [
  'IMPORTED',
  'DISCOVERED',
  'CONTACT_FOUND',
  'VERIFIED',
  'UNCERTAIN',
  'EMAIL_SENT',
  'REPLIED',
  'DEMO_BOOKED',
  'INVALID',
  'OUT_OF_AREA',
  'SKIPPED',
];

export const CLUB_STATUS_COLORS: Record<ClubStatus, string> = {
  IMPORTED: 'bg-slate-100 text-slate-600',
  DISCOVERED: 'bg-slate-100 text-slate-700',
  CONTACT_FOUND: 'bg-sky-100 text-sky-700',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  UNCERTAIN: 'bg-amber-100 text-amber-700',
  INVALID: 'bg-rose-100 text-rose-700',
  OUT_OF_AREA: 'bg-orange-100 text-orange-700',
  EMAIL_SENT: 'bg-indigo-100 text-indigo-700',
  REPLIED: 'bg-violet-100 text-violet-700',
  DEMO_BOOKED: 'bg-brand-100 text-brand-700',
  SKIPPED: 'bg-slate-100 text-slate-500',
};

export const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  UNCERTAIN: 'bg-amber-100 text-amber-700',
  INVALID: 'bg-rose-100 text-rose-700',
};

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
