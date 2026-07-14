'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card } from '@/components/ui';
import { ApiRequestError } from '@/lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', teamName: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        teamName: form.teamName || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-700">Create your workspace</h1>
        <p className="mt-1 text-sm text-slate-500">Start finding and reaching club managers.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Your name">
            <input required value={form.name} onChange={update('name')} className="input" />
          </Field>
          <Field label="Email">
            <input type="email" required value={form.email} onChange={update('email')} className="input" />
          </Field>
          <Field label="Password (min 8 chars)">
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={update('password')}
              className="input"
            />
          </Field>
          <Field label="Team name (optional)">
            <input value={form.teamName} onChange={update('teamName')} className="input" />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating...' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
