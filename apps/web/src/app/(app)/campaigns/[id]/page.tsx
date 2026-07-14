'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ClubDto } from '@courtreach/shared';
import {
  useAnalytics,
  useCampaign,
  useCampaignAction,
  useCampaignClubs,
  useCampaignJobs,
  useCancelJob,
  useDeleteCampaign,
  useImportClubs,
  useReviewClub,
  useUpdateClubStatus,
} from '@/lib/hooks';
import { downloadFile } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import {
  CLUB_STATUS_COLORS,
  CLUB_STATUS_LABELS,
  PIPELINE_ORDER,
  VERIFICATION_COLORS,
  formatPercent,
} from '@/lib/format';

/** Statuses that represent "put aside" clubs, hidden from the directory by default. */
const DISMISSED_STATUSES = new Set(['SKIPPED', 'OUT_OF_AREA']);

type Tab = 'directory' | 'pipeline' | 'review' | 'analytics';

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const campaign = useCampaign(id);
  const jobs = useCampaignJobs(id);
  const action = useCampaignAction(id);
  const cancelJob = useCancelJob(id);
  const deleteCampaign = useDeleteCampaign();
  const importClubs = useImportClubs(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('directory');
  // Persist the last action error so it survives re-mutations clearing isError
  const [actionError, setActionError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (action.isError) {
      setActionError((action.error as Error).message ?? 'Action failed. Please try again.');
    }
    // Clear the persisted error once a new action succeeds
    if (action.isSuccess) {
      setActionError(null);
    }
  }, [action.isError, action.isSuccess, action.error]);

  if (campaign.isLoading) return <Spinner />;
  if (!campaign.data) return <EmptyState title="Campaign not found" />;

  const c = campaign.data;
  const activeJob = jobs.data?.find((j) => j.status === 'RUNNING' || j.status === 'QUEUED');
  // Always show the most recent failed job — don't hide it just because a new job is queued
  const failedJob = jobs.data?.find((j) => j.status === 'FAILED');

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const csv = String(reader.result ?? '');
      importClubs.mutate(csv, {
        onSuccess: (result) => {
          setImportNotice(
            `Imported ${result.imported} club${result.imported === 1 ? '' : 's'}. Run discovery to verify which are in this area.`,
          );
        },
        onError: (err) => setImportNotice((err as Error).message ?? 'Import failed.'),
      });
    };
    reader.readAsText(file);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadFile(`/campaigns/${id}/clubs/export`, `clubs-${id}.csv`);
    } catch (err) {
      setActionError((err as Error).message ?? 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  function handleDelete() {
    if (!confirm(`Delete campaign "${c.name}"? This will permanently remove all clubs, contacts, and jobs associated with it.`)) return;
    deleteCampaign.mutate(id, { onSuccess: () => router.push('/dashboard') });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:underline">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <p className="text-sm text-slate-500">
            {c.region.label} &middot; {c.sportTypes.join(', ').toLowerCase()} &middot;{' '}
            {c.autoSendVerified ? 'auto-send on' : 'approval required'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            disabled={importClubs.isPending}
            title="Import a CSV of club names (one per row) to verify against this region"
            onClick={() => { setImportNotice(null); fileInputRef.current?.click(); }}
          >
            {importClubs.isPending ? 'Importing…' : 'Import CSV'}
          </Button>
          <Button variant="secondary" disabled={exporting} onClick={handleExport}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button
            variant="secondary"
            disabled={action.isPending || !!activeJob}
            onClick={() => { setActionError(null); action.mutate('discover'); }}
          >
            Run discovery
          </Button>
          <Button
            variant="secondary"
            disabled={action.isPending || !!activeJob}
            onClick={() => { setActionError(null); action.mutate('verify'); }}
          >
            Verify
          </Button>
          <Button disabled={action.isPending || !!activeJob} onClick={() => { setActionError(null); action.mutate('send'); }}>
            Send verified
          </Button>
          <Button
            variant="danger"
            disabled={deleteCampaign.isPending}
            onClick={handleDelete}
          >
            {deleteCampaign.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </header>

      {importNotice && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 flex items-start justify-between gap-2">
          <span>{importNotice}</span>
          <button
            onClick={() => setImportNotice(null)}
            className="shrink-0 text-brand-400 hover:text-brand-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start justify-between gap-2">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="shrink-0 text-rose-400 hover:text-rose-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {activeJob && (
        <Card className="border-brand-200 bg-brand-50">
          <div className="flex items-center gap-3">
            <Spinner />
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-700">
                {activeJob.type.toLowerCase()} in progress
                {activeJob.total > 0 && ` (${activeJob.progress}/${activeJob.total})`}
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{
                    width: `${activeJob.total ? (activeJob.progress / activeJob.total) * 100 : 10}%`,
                  }}
                />
              </div>
            </div>
            <Button
              variant="danger"
              disabled={cancelJob.isPending}
              onClick={() => cancelJob.mutate(activeJob.id)}
            >
              {cancelJob.isPending ? 'Stopping…' : 'Stop'}
            </Button>
          </div>
        </Card>
      )}

      {failedJob && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-medium text-rose-700">
            {failedJob.type.charAt(0) + failedJob.type.slice(1).toLowerCase()} failed
          </p>
          {failedJob.error && (
            <p className="mt-1 text-xs text-rose-600">{failedJob.error}</p>
          )}
        </div>
      )}

      <nav className="flex gap-1 border-b border-slate-200">
        {(['directory', 'pipeline', 'review', 'analytics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'review' ? 'Review queue' : t}
          </button>
        ))}
      </nav>

      {tab === 'directory' && <DirectoryView campaignId={id} />}
      {tab === 'pipeline' && <PipelineBoard campaignId={id} />}
      {tab === 'review' && <ReviewQueue campaignId={id} />}
      {tab === 'analytics' && <AnalyticsPanel campaignId={id} />}
    </div>
  );
}

function externalHref(website: string | null): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function DirectoryView({ campaignId }: { campaignId: string }) {
  const clubs = useCampaignClubs(campaignId);
  const updateStatus = useUpdateClubStatus(campaignId);
  const [showDismissed, setShowDismissed] = useState(false);

  if (clubs.isLoading) return <Spinner />;
  if (!clubs.data || clubs.data.length === 0) {
    return (
      <EmptyState
        title="No racquet clubs yet"
        hint="Run discovery to find every racquet club in this region, or import a CSV of known clubs."
      />
    );
  }

  const sorted = [...clubs.data].sort((a, b) => a.name.localeCompare(b.name));
  const dismissedCount = sorted.filter((c) => DISMISSED_STATUSES.has(c.status)).length;
  const visible = showDismissed
    ? sorted
    : sorted.filter((c) => !DISMISSED_STATUSES.has(c.status));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {visible.length} racquet {visible.length === 1 ? 'club' : 'clubs'}. Click a name to open
          the club&apos;s website.
        </p>
        {dismissedCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show dismissed ({dismissedCount})
          </label>
        )}
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Club</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Sport</th>
                <th className="px-4 py-3 font-medium">Membership system</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((club) => {
                const href = externalHref(club.website);
                const dismissed = DISMISSED_STATUSES.has(club.status);
                return (
                  <tr
                    key={club.id}
                    className={`hover:bg-slate-50 ${dismissed ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {club.name}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-700">
                          {club.name}{' '}
                          <span className="text-xs font-normal text-slate-400">(no website)</span>
                        </span>
                      )}
                      <div className="mt-0.5">
                        <Link
                          href={`/clubs/${club.id}`}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          View contacts &rarr;
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={CLUB_STATUS_COLORS[club.status]}>
                        {CLUB_STATUS_LABELS[club.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{club.address ?? '—'}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">
                      {club.sportType.toLowerCase()}
                    </td>
                    <td className="px-4 py-3">
                      {club.membershipSystem ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {club.membershipSystem}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500">Unknown</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {club.status === 'SKIPPED' ? (
                        <button
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ clubId: club.id, status: 'DISCOVERED' })
                          }
                          className="text-xs text-brand-500 hover:underline disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ clubId: club.id, status: 'SKIPPED' })
                          }
                          className="text-xs text-slate-400 hover:text-rose-500 hover:underline disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PipelineBoard({ campaignId }: { campaignId: string }) {
  const clubs = useCampaignClubs(campaignId);
  if (clubs.isLoading) return <Spinner />;
  if (!clubs.data || clubs.data.length === 0) {
    return <EmptyState title="No clubs yet" hint="Run discovery to populate the pipeline." />;
  }

  const byStatus = PIPELINE_ORDER.map((status) => ({
    status,
    clubs: clubs.data!.filter((c) => c.status === status),
  })).filter((col) => col.clubs.length > 0);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {byStatus.map((col) => (
        <div key={col.status} className="w-72 shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <Badge className={CLUB_STATUS_COLORS[col.status]}>{CLUB_STATUS_LABELS[col.status]}</Badge>
            <span className="text-xs text-slate-400">{col.clubs.length}</span>
          </div>
          <div className="space-y-2">
            {col.clubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VerificationIcon({ status }: { status: string }) {
  if (status === 'VERIFIED') return <span className="font-semibold text-emerald-500">✓</span>;
  if (status === 'INVALID') return <span className="font-semibold text-rose-500">✗</span>;
  return null;
}

function ClubCard({ club }: { club: ClubDto }) {
  const primary = club.contacts[0];
  return (
    <Link href={`/clubs/${club.id}`}>
      <Card className="p-3 transition hover:border-brand-300 hover:shadow">
        <p className="text-sm font-semibold">{club.name}</p>
        {primary?.email && (
          <p className="flex items-center gap-1 truncate text-xs text-slate-500">
            <VerificationIcon status={primary.verificationStatus} />
            {primary.email}
          </p>
        )}
        {primary && (
          <div className="mt-2">
            <Badge className={VERIFICATION_COLORS[primary.verificationStatus]}>
              {primary.verificationStatus.toLowerCase()}
              {primary.confidenceScore != null && ` ${formatPercent(primary.confidenceScore)}`}
            </Badge>
          </div>
        )}
      </Card>
    </Link>
  );
}

function ReviewQueue({ campaignId }: { campaignId: string }) {
  const clubs = useCampaignClubs(campaignId, 'UNCERTAIN');
  const review = useReviewClub();

  if (clubs.isLoading) return <Spinner />;
  if (!clubs.data || clubs.data.length === 0) {
    return <EmptyState title="Nothing to review" hint="Uncertain contacts will appear here." />;
  }

  return (
    <div className="space-y-3">
      {clubs.data.map((club) => {
        const primary = club.contacts[0];
        return (
          <Card key={club.id} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <Link href={`/clubs/${club.id}`} className="font-semibold hover:underline">
                {club.name}
              </Link>
              <p className="text-sm text-slate-500">{primary?.email ?? 'No email found'}</p>
              {primary?.reasoning && (
                <p className="mt-1 text-xs text-amber-700">{primary.reasoning}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={review.isPending}
                onClick={() => review.mutate({ clubId: club.id, decision: 'SKIP' })}
              >
                Skip
              </Button>
              <Button
                disabled={review.isPending || !primary?.email}
                onClick={() => review.mutate({ clubId: club.id, decision: 'APPROVE_SEND' })}
              >
                Approve &amp; send
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AnalyticsPanel({ campaignId }: { campaignId: string }) {
  const analytics = useAnalytics(campaignId);
  if (analytics.isLoading) return <Spinner />;
  if (!analytics.data) return null;
  const a = analytics.data;

  const stats = [
    { label: 'Total clubs', value: a.totalClubs },
    { label: 'Emails sent', value: a.emailsSent },
    { label: 'Replies', value: a.replies },
    { label: 'Demos booked', value: a.demosBooked },
    { label: 'Reply rate', value: formatPercent(a.replyRate) },
    { label: 'Demo rate', value: formatPercent(a.demoRate) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {stats.map((s) => (
        <Card key={s.label}>
          <p className="text-sm text-slate-500">{s.label}</p>
          <p className="mt-1 text-2xl font-bold">{s.value}</p>
        </Card>
      ))}
    </div>
  );
}
