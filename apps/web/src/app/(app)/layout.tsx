'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { NavLink, Spinner } from '@/components/ui';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, team, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <Link href="/dashboard" className="px-3 text-xl font-bold text-brand-700">
          CourtReach
        </Link>
        <p className="mb-6 mt-1 px-3 text-xs text-slate-400">{team?.name}</p>
        <nav className="space-y-1">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/campaigns/new">New campaign</NavLink>
          <NavLink href="/settings">Team &amp; settings</NavLink>
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="px-3 text-sm font-medium text-slate-700">{user.name}</p>
          <p className="px-3 text-xs text-slate-400">{user.email}</p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden bg-slate-50 p-6 md:p-8">{children}</main>
    </div>
  );
}
