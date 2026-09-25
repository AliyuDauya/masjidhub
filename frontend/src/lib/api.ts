export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function tokenKey(slug: string) {
  return `masjidhub:${slug}:token`;
}

export function getToken(slug: string) {
  if (typeof window === 'undefined') return null;
  const specific = localStorage.getItem(tokenKey(slug));
  if (specific) return specific;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('masjidhub:') && key.endsWith(':token') && !key.includes('platform')) {
      const val = localStorage.getItem(key);
      if (val) return val;
    }
  }
  return null;
}

export function setToken(slug: string, token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(tokenKey(slug), token);
  }
}

export function clearToken(slug: string) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(tokenKey(slug));
    localStorage.removeItem('masjidhub:csrf_token');
  }
}

export function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)mh_csrf=([^;]+)/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return localStorage.getItem('masjidhub:csrf_token');
}

export function setCsrfToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('masjidhub:csrf_token', token);
  }
}

export async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    }
  } catch {
    // Non-blocking fallback
  }
  return '';
}

export async function api<T>(slug: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (slug) headers.set('X-Mosque-Slug', slug);
  const token = slug ? getToken(slug) : typeof window === 'undefined' ? null : localStorage.getItem('masjidhub:platform:token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const method = (init.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutation) {
    let csrfToken = getCsrfToken();
    if (!csrfToken && typeof window !== 'undefined') {
      csrfToken = await fetchCsrfToken();
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });

  const data = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(
      typeof data === 'object' && data?.error ? data.error : 'Request failed.',
      response.status
    );
  }

  if (typeof data === 'object' && data !== null && 'csrfToken' in data && typeof (data as Record<string, unknown>).csrfToken === 'string') {
    setCsrfToken((data as Record<string, unknown>).csrfToken as string);
  }

  return data as T;
}
