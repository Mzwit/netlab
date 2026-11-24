import { useSyncExternalStore } from 'react';
import { store } from './store';

/** Optional backend. Enabled only when VITE_API_URL is set at build time. */
export const API_URL: string | undefined = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');

interface User { id: number; email: string; name: string; role: string }
interface Session { token: string; user: User }
const KEY = 'netlab:session';
let session: Session | null = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } })();
const subs = new Set<() => void>();
const setSession = (s: Session | null) => {
  session = s;
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  subs.forEach((f) => f());
};
export const useSession = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => session);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('No backend configured');
  let r: Response;
  try {
    r = await fetch(API_URL + path, { method, headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the NETLAB server');
  }
  if (r.status === 401 && session && !path.startsWith('/api/auth')) setSession(null);
  const data = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string })?.error ?? `Request failed (${r.status})`);
  return data as T;
}

export async function pull() {
  const { data } = await call<{ data: unknown }>('GET', '/api/progress');
  if (data) store.import(JSON.stringify(data));
  else await push();
}
export const push = () => call('PUT', '/api/progress', { data: JSON.parse(store.export()) });

export async function authenticate(mode: 'login' | 'register', email: string, password: string, name = '') {
  const s = await call<Session>('POST', `/api/auth/${mode}`, { email, password, name });
  setSession(s);
  await pull();
}
export function logout() { call('POST', '/api/auth/logout').catch(() => {}); setSession(null); }

// Auto-sync local changes to the server (debounced) while signed in.
let timer: ReturnType<typeof setTimeout> | undefined;
store.subscribe(() => {
  if (!API_URL || !session) return;
  clearTimeout(timer);
  timer = setTimeout(() => { push().catch(() => {}); }, 1500);
});
