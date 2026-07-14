import type { ApiError } from '@courtreach/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'courtreach_token';
const TEAM_KEY = 'courtreach_team';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getTeamId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TEAM_KEY);
}

export function setTeamId(teamId: string | null) {
  if (typeof window === 'undefined') return;
  if (teamId) window.localStorage.setItem(TEAM_KEY, teamId);
  else window.localStorage.removeItem(TEAM_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip attaching the auth token (for login/register). */
  anonymous?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!options.anonymous) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const teamId = getTeamId();
    if (teamId) headers['x-team-id'] = teamId;
  }

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    throw new ApiRequestError(res.status, err.error ?? 'Request failed', err.details);
  }
  return data as T;
}

/**
 * Fetch a file (e.g. CSV export) with auth headers and trigger a browser
 * download. Kept separate from apiFetch because it handles a binary/text blob
 * instead of JSON.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const teamId = getTeamId();
  if (teamId) headers['x-team-id'] = teamId;

  const res = await fetch(`${BASE_URL}/api${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = data as ApiError;
    throw new ApiRequestError(res.status, err.error ?? 'Download failed', err.details);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
