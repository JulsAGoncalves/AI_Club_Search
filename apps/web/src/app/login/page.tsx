'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card } from '@/components/ui';
import { ApiRequestError } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-700">CourtReach</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your team workspace.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          No account?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Create one
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
