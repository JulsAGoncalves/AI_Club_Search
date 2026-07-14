'use client';

import { useEffect, useState } from 'react';
import {
  useIntegrations,
  useInviteMember,
  useMembers,
  useSaveTemplate,
  useTemplate,
} from '@/lib/hooks';
import { Badge, Button, Card, Spinner } from '@/components/ui';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">Team &amp; settings</h1>
      <IntegrationsCard />
      <TemplateCard />
      <TeamCard />
    </div>
  );
}

function IntegrationsCard() {
  const integrations = useIntegrations();
  const labels: Record<string, string> = {
    ai: 'AI provider (verification + drafting)',
    hunter: 'Hunter.io (contact finder)',
    smtp: 'SMTP email sending',
    imap: 'IMAP reply detection',
  };
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Integrations
      </h2>
      <Card>
        {integrations.isLoading ? (
          <Spinner />
        ) : (
          <ul className="space-y-2">
            {Object.entries(labels).map(([key, label]) => {
              const on = integrations.data?.[key];
              return (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{label}</span>
                  <Badge className={on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                    {on ? 'Connected' : 'Not configured'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Configure keys in your <code>.env</code> file. Missing integrations fall back to safe stubs
          so the pipeline still runs.
        </p>
      </Card>
    </section>
  );
}

function TemplateCard() {
  const template = useTemplate();
  const save = useSaveTemplate();
  const [form, setForm] = useState({ subject: '', body: '', demoLink: '', signOff: '' });

  useEffect(() => {
    if (template.data) {
      setForm({
        subject: template.data.subject ?? '',
        body: template.data.body ?? '',
        demoLink: template.data.demoLink ?? '',
        signOff: template.data.signOff ?? '',
      });
    }
  }, [template.data]);

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Email template
      </h2>
      <Card className="space-y-3">
        <p className="text-xs text-slate-400">
          Use placeholders <code>[Club name]</code>, <code>[Manager name]</code>,{' '}
          <code>[Sport type]</code>, <code>[Sender name]</code>. The AI adapts this per club.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Subject</span>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Body</span>
          <textarea
            rows={8}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="textarea"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Demo booking link</span>
            <input
              value={form.demoLink}
              onChange={(e) => setForm({ ...form, demoLink: e.target.value })}
              className="input"
              placeholder="https://calendly.com/..."
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Sign-off</span>
            <input
              value={form.signOff}
              onChange={(e) => setForm({ ...form, signOff: e.target.value })}
              className="input"
            />
          </label>
        </div>
        <Button
          disabled={save.isPending || !form.subject || !form.body}
          onClick={() =>
            save.mutate({
              subject: form.subject,
              body: form.body,
              demoLink: form.demoLink || undefined,
              signOff: form.signOff || undefined,
            })
          }
        >
          {save.isPending ? 'Saving...' : 'Save template'}
        </Button>
      </Card>
    </section>
  );
}

function TeamCard() {
  const members = useMembers();
  const invite = useInviteMember();
  const [email, setEmail] = useState('');
  const [lastInvite, setLastInvite] = useState<string | null>(null);

  async function onInvite() {
    const res = await invite.mutateAsync({ email, role: 'MEMBER' });
    setLastInvite(res.token);
    setEmail('');
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Team</h2>
      <Card className="space-y-4">
        {members.isLoading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.data?.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{m.user.name}</p>
                  <p className="text-xs text-slate-400">{m.user.email}</p>
                </div>
                <Badge className="bg-slate-100 text-slate-600">{m.role.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@email.com"
            className="input"
          />
          <Button disabled={invite.isPending || !email} onClick={onInvite}>
            Invite
          </Button>
        </div>
        {lastInvite && (
          <p className="text-xs text-slate-500">
            Invite created. Share this token (email delivery not configured):{' '}
            <code className="rounded bg-slate-100 px-1">{lastInvite}</code>
          </p>
        )}
      </Card>
    </section>
  );
}
