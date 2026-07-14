'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SPORT_TYPES, type SportType } from '@courtreach/shared';
import { useCreateCampaign } from '@/lib/hooks';
import { Button, Card } from '@/components/ui';
import { ApiRequestError } from '@/lib/api';

export default function NewCampaignPage() {
  const router = useRouter();
  const create = useCreateCampaign();
  const [name, setName] = useState('');
  const [regionLabel, setRegionLabel] = useState('');
  const [sports, setSports] = useState<SportType[]>(['TENNIS']);
  const [autoSend, setAutoSend] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [followUpDays, setFollowUpDays] = useState(5);
  const [error, setError] = useState<string | null>(null);

  function toggleSport(s: SportType) {
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (sports.length === 0) {
      setError('Select at least one sport.');
      return;
    }
    try {
      const campaign = await create.mutateAsync({
        name,
        region: { label: regionLabel },
        sportTypes: sports,
        autoSendVerified: autoSend,
        dailySendLimit: dailyLimit,
        followUpDays,
      });
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to create campaign');
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">New campaign</h1>
      <p className="text-sm text-slate-500">Define the region and sports to scan.</p>

      <Card className="mt-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Campaign name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ontario racquet clubs"
              className="input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Region</span>
            <input
              required
              value={regionLabel}
              onChange={(e) => setRegionLabel(e.target.value)}
              placeholder="London, Ontario, Canada"
              className="input"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Be specific to avoid ambiguity — e.g. &quot;London, England, UK&quot; or &quot;London,
              Ontario, Canada&quot; rather than just &quot;London&quot;. The area is geocoded when
              discovery runs.
            </span>
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Sports</span>
            <div className="flex flex-wrap gap-2">
              {SPORT_TYPES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSport(s)}
                  className={`rounded-full border px-4 py-1.5 text-sm capitalize transition ${
                    sports.includes(s)
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Daily send limit</span>
              <input
                type="number"
                min={1}
                max={500}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Follow-up after (days)</span>
              <input
                type="number"
                min={1}
                max={60}
                value={followUpDays}
                onChange={(e) => setFollowUpDays(Number(e.target.value))}
                className="input"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-slate-700">
              Auto-send to <strong>verified</strong> contacts (uncertain ones always need approval)
            </span>
          </label>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating...' : 'Create campaign'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
