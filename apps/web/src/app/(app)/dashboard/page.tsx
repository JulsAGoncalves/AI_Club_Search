'use client';

import Link from 'next/link';
import type { CampaignDto } from '@courtreach/shared';
import { useCampaigns, useActivity } from '@/lib/hooks';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { CLUB_STATUS_COLORS, CLUB_STATUS_LABELS, formatDate } from '@/lib/format';

export default function DashboardPage() {
  const campaigns = useCampaigns();
  const activity = useActivity();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Your outreach campaigns at a glance.</p>
        </div>
        <Link href="/campaigns/new">
          <Button>New campaign</Button>
        </Link>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Campaigns
          </h2>
          {campaigns.isLoading ? (
            <Spinner />
          ) : campaigns.data && campaigns.data.length > 0 ? (
            <div className="space-y-3">
              {campaigns.data.map((c) => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No campaigns yet"
              hint="Create your first campaign to start discovering clubs."
            />
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Activity
          </h2>
          <Card className="max-h-[28rem] overflow-y-auto">
            {activity.data && activity.data.length > 0 ? (
              <ul className="space-y-3">
                {activity.data.map((a) => (
                  <li key={a.id} className="text-sm">
                    <span className="font-medium text-slate-700">{a.actor}</span>{' '}
                    <span className="text-slate-600">{a.action}</span>
                    <div className="text-xs text-slate-400">{formatDate(a.createdAt)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No activity yet.</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignDto }) {
  const counts = campaign.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="transition hover:border-brand-300 hover:shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{campaign.name}</p>
            <p className="text-sm text-slate-500">
              {campaign.region.label} &middot; {campaign.sportTypes.join(', ').toLowerCase()}
            </p>
          </div>
          <Badge className="bg-slate-100 text-slate-600">{campaign.status.toLowerCase()}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="bg-slate-100 text-slate-600">{total} clubs</Badge>
          {counts &&
            (['VERIFIED', 'UNCERTAIN', 'EMAIL_SENT', 'REPLIED'] as const).map((s) =>
              counts[s] > 0 ? (
                <Badge key={s} className={CLUB_STATUS_COLORS[s]}>
                  {counts[s]} {CLUB_STATUS_LABELS[s].toLowerCase()}
                </Badge>
              ) : null,
            )}
        </div>
      </Card>
    </Link>
  );
}
