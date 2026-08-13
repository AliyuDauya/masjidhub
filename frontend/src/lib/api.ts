export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function tokenKey(slug: string) { return `masjidhub:${slug}:token`; }
export function getToken(slug: string) { return typeof window === 'undefined' ? null : localStorage.getItem(tokenKey(slug)); }
export function setToken(slug: string, token: string) { localStorage.setItem(tokenKey(slug), token); }
export function clearToken(slug: string) { localStorage.removeItem(tokenKey(slug)); }

export async function api<T>(slug: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (slug) headers.set('X-Mosque-Slug', slug);
  const token = slug ? getToken(slug) : typeof window === 'undefined' ? null : localStorage.getItem('masjidhub:platform:token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(typeof data === 'object' && data?.error ? data.error : 'Request failed.', response.status);
  return data as T;
}
