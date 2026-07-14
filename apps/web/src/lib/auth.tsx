'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthResponse, MembershipRole, TeamDto, UserDto } from '@courtreach/shared';
import { apiFetch, getToken, setTeamId, setToken } from './api';

interface AuthState {
  user: UserDto | null;
  team: TeamDto | null;
  role: MembershipRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; teamName?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface MeResponse {
  user: UserDto;
  team: TeamDto;
  role: MembershipRole;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);
  const [team, setTeam] = useState<TeamDto | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<MeResponse>('/auth/me')
      .then((me) => {
        setUser(me.user);
        setTeam(me.team);
        setRole(me.role);
        setTeamId(me.team.id);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  function applyAuth(res: AuthResponse) {
    setToken(res.token);
    setTeamId(res.team.id);
    setUser(res.user);
    setTeam(res.team);
    setRole(res.role);
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      team,
      role,
      loading,
      async login(email, password) {
        const res = await apiFetch<AuthResponse>('/auth/login', {
          method: 'POST',
          body: { email, password },
          anonymous: true,
        });
        applyAuth(res);
        router.push('/dashboard');
      },
      async register(input) {
        const res = await apiFetch<AuthResponse>('/auth/register', {
          method: 'POST',
          body: input,
          anonymous: true,
        });
        applyAuth(res);
        router.push('/dashboard');
      },
      logout() {
        setToken(null);
        setTeamId(null);
        setUser(null);
        setTeam(null);
        setRole(null);
        router.push('/login');
      },
    }),
    [user, team, role, loading, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
