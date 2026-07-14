'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useClub, useSaveDraft } from '@/lib/hooks';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';
import { CLUB_STATUS_COLORS, CLUB_STATUS_LABELS, VERIFICATION_COLORS, formatDate, formatPercent } from '@/lib/format';

function VerificationIcon({ status }: { status: string }) {
  if (status === 'VERIFIED') return <span className="font-semibold text-emerald-500">✓</span>;
  if (status === 'INVALID') return <span className="font-semibold text-rose-500">✗</span>;
  return null;
}

export default function ClubPage() {
  const { id } = useParams<{ id: string }>();
  const club = useClub(id);
  const saveDraft = useSaveDraft(id);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (club.data?.outreach && !dirty) {
      setSubject(club.data.outreach.subject);
      setBody(club.data.outreach.body);
    }
  }, [club.data, dirty]);

  if (club.isLoading) return <Spinner />;
  if (!club.data) return <EmptyState title="Club not found" />;

  const c = club.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="#" onClick={() => history.back()} className="text-sm text-slate-400 hover:underline">
          &larr; Back
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <Badge className={CLUB_STATUS_COLORS[c.status]}>{CLUB_STATUS_LABELS[c.status]}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          {c.sportType.toLowerCase()}
          {c.address ? ` · ${c.address}` : ''}
          {c.website ? ' · ' : ''}
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              website
            </a>
          )}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Contacts</h2>
        {c.contacts.length === 0 ? (
          <EmptyState title="No contacts found" />
        ) : (
          <div className="space-y-2">
            {c.contacts.map((contact) => (
              <Card key={contact.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {contact.name ?? 'Unknown name'}
                    {contact.role ? <span className="text-slate-500"> · {contact.role}</span> : null}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-slate-600">
                    <VerificationIcon status={contact.verificationStatus} />
                    {contact.email ?? 'No email'}
                  </p>
                  {contact.reasoning && (
                    <p className="mt-1 text-xs text-slate-400">{contact.reasoning}</p>
                  )}
                </div>
                <Badge className={VERIFICATION_COLORS[contact.verificationStatus]}>
                  {contact.verificationStatus.toLowerCase()}
                  {contact.confidenceScore != null && ` ${formatPercent(contact.confidenceScore)}`}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Email draft
        </h2>
        <Card className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Subject</span>
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setDirty(true);
              }}
              className="input"
              placeholder="Generated after verification / sending"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Body</span>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setDirty(true);
              }}
              rows={10}
              className="textarea"
              placeholder="The AI-written draft will appear here once generated."
            />
          </label>
          <div className="flex items-center gap-3">
            <Button
              disabled={saveDraft.isPending || !subject || !body}
              onClick={() => saveDraft.mutate({ subject, body }, { onSuccess: () => setDirty(false) })}
            >
              {saveDraft.isPending ? 'Saving...' : 'Save draft'}
            </Button>
            {saveDraft.isSuccess && !dirty && (
              <span className="text-sm text-emerald-600">Saved</span>
            )}
          </div>
        </Card>
      </section>

      {c.outreach && c.outreach.messages.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Thread</h2>
          <div className="space-y-2">
            {c.outreach.messages.map((m) => (
              <Card
                key={m.id}
                className={m.direction === 'INBOUND' ? 'border-violet-200 bg-violet-50' : ''}
              >
                <div className="mb-1 flex items-center justify-between">
                  <Badge
                    className={
                      m.direction === 'INBOUND'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }
                  >
                    {m.direction === 'INBOUND' ? 'Reply' : 'Sent'}
                  </Badge>
                  <span className="text-xs text-slate-400">{formatDate(m.createdAt)}</span>
                </div>
                {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                <p className="whitespace-pre-wrap text-sm text-slate-600">{m.body}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
