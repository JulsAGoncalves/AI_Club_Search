'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CampaignDto } from '@courtreach/shared';
import {
  useCampaigns,
  useActivity,
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useSetGroupCampaigns,
  type CampaignGroupWithIds,
} from '@/lib/hooks';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { CLUB_STATUS_COLORS, CLUB_STATUS_LABELS, formatDate } from '@/lib/format';

// ---------------------------------------------------------------------------
// Group name modal (create or rename)
// ---------------------------------------------------------------------------

function GroupModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold">
          {initial ? 'Rename group' : 'New group'}
        </h2>
        <input
          autoFocus
          type="text"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="e.g. Alberta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim());
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm-delete modal
// ---------------------------------------------------------------------------

function ConfirmModal({
  message,
  onConfirm,
  onClose,
}: {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <p className="text-sm text-slate-700">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single campaign card
// ---------------------------------------------------------------------------

function CampaignRow({
  campaign,
  groups,
}: {
  campaign: CampaignDto;
  groups: CampaignGroupWithIds[];
}) {
  const setGroupCampaigns = useSetGroupCampaigns();

  function handleGroupChange(newGroupId: string) {
    if (newGroupId === (campaign.groupId ?? '')) return;

    if (newGroupId === '') {
      // Remove from current group
      if (!campaign.groupId) return;
      const current = groups.find((g) => g.id === campaign.groupId);
      if (!current) return;
      setGroupCampaigns.mutate({
        groupId: current.id,
        campaignIds: current.campaignIds.filter((id) => id !== campaign.id),
      });
    } else {
      // Add to the target group
      const target = groups.find((g) => g.id === newGroupId);
      if (!target) return;
      const newIds = target.campaignIds.includes(campaign.id)
        ? target.campaignIds
        : [...target.campaignIds, campaign.id];
      setGroupCampaigns.mutate({ groupId: newGroupId, campaignIds: newIds });
    }
  }

  const counts = campaign.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex items-stretch gap-2">
      <Link href={`/campaigns/${campaign.id}`} className="min-w-0 flex-1">
        <Card className="h-full transition hover:border-brand-300 hover:shadow">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold">{campaign.name}</p>
              <p className="truncate text-sm text-slate-500">
                {campaign.region.label} &middot; {campaign.sportTypes.join(', ').toLowerCase()}
              </p>
            </div>
            <Badge className="ml-2 shrink-0 bg-slate-100 text-slate-600">
              {campaign.status.toLowerCase()}
            </Badge>
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

      {/* Group assignment selector */}
      {groups.length > 0 && (
        <div className="flex items-center">
          <select
            title="Move to group"
            value={campaign.groupId ?? ''}
            onChange={(e) => handleGroupChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm outline-none hover:border-brand-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible group section
// ---------------------------------------------------------------------------

function GroupSection({
  group,
  campaigns,
  groups,
  onRename,
  onDelete,
}: {
  group: CampaignGroupWithIds;
  campaigns: CampaignDto[];
  groups: CampaignGroupWithIds[];
  onRename: (g: CampaignGroupWithIds) => void;
  onDelete: (g: CampaignGroupWithIds) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          {group.name}
          <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {campaigns.length}
          </span>
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => onRename(group)}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          >
            Rename
          </button>
          <button
            onClick={() => onDelete(group)}
            className="rounded px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-700"
          >
            Delete
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {campaigns.length === 0 ? (
            <p className="text-sm text-slate-400">No campaigns in this group yet.</p>
          ) : (
            campaigns.map((c) => <CampaignRow key={c.id} campaign={c} groups={groups} />)
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const campaigns = useCampaigns();
  const activity = useActivity();
  const groups = useGroups();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renaming, setRenaming] = useState<CampaignGroupWithIds | null>(null);
  const [deleting, setDeleting] = useState<CampaignGroupWithIds | null>(null);

  const allGroups = groups.data ?? [];
  const allCampaigns = campaigns.data ?? [];

  // Build lookup: groupId → campaigns
  const campaignsByGroup = new Map<string, CampaignDto[]>();
  const ungrouped: CampaignDto[] = [];
  for (const c of allCampaigns) {
    if (c.groupId) {
      const arr = campaignsByGroup.get(c.groupId) ?? [];
      arr.push(c);
      campaignsByGroup.set(c.groupId, arr);
    } else {
      ungrouped.push(c);
    }
  }

  const isLoading = campaigns.isLoading || groups.isLoading;

  return (
    <>
      {showCreateModal && (
        <GroupModal
          onClose={() => setShowCreateModal(false)}
          onSave={(name) => {
            createGroup.mutate({ name }, { onSuccess: () => setShowCreateModal(false) });
          }}
        />
      )}

      {renaming && (
        <GroupModal
          initial={renaming.name}
          onClose={() => setRenaming(null)}
          onSave={(name) => {
            updateGroup.mutate({ id: renaming.id, name }, { onSuccess: () => setRenaming(null) });
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          message={`Delete group "${deleting.name}"? Campaigns inside will become ungrouped.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            deleteGroup.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
          }}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-slate-500">Your outreach campaigns at a glance.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
              New group
            </Button>
            <Link href="/campaigns/new">
              <Button>New campaign</Button>
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Campaigns
            </h2>

            {isLoading ? (
              <Spinner />
            ) : allCampaigns.length === 0 ? (
              <EmptyState
                title="No campaigns yet"
                hint="Create your first campaign to start discovering clubs."
              />
            ) : (
              <div className="space-y-4">
                {/* Groups */}
                {allGroups.map((group) => (
                  <GroupSection
                    key={group.id}
                    group={group}
                    campaigns={campaignsByGroup.get(group.id) ?? []}
                    groups={allGroups}
                    onRename={setRenaming}
                    onDelete={setDeleting}
                  />
                ))}

                {/* Ungrouped campaigns */}
                {ungrouped.length > 0 && (
                  <div>
                    {allGroups.length > 0 && (
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Ungrouped
                      </h3>
                    )}
                    <div className="space-y-3">
                      {ungrouped.map((c) => (
                        <CampaignRow key={c.id} campaign={c} groups={allGroups} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
    </>
  );
}
