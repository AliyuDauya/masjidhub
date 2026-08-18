'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Tenant {
  mosque_id: number;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  _count: { memberships: number; donations: number; programs: number };
}

export default function PlatformConsole() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  async function load() {
    try {
      setTenants(await api<Tenant[]>(null, '/api/platform/tenants'));
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await api<{ token: string }>(null, '/api/platform/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('masjidhub:platform:token', result.token);
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Sign-in failed.');
    }
  }

  async function status(id: number, value: string) {
    try {
      await api(null, `/api/platform/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: value }),
      });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Status could not be changed.');
    }
  }

  if (!authenticated) {
    return (
      <div className="relative min-h-screen bg-[#f7f6f2] text-[#1c1c1c] grid place-items-center p-6 selection:bg-[#3d7068] selection:text-white">
        <div className="editorial-grid-bg" aria-hidden="true" />
        <div className="guide-line guide-line-25 hidden md:block" aria-hidden="true" />
        <div className="guide-line guide-line-50 hidden md:block" aria-hidden="true" />
        <div className="guide-line guide-line-75 hidden md:block" aria-hidden="true" />

        <form
          onSubmit={login}
          className="relative z-10 card-editorial bg-white p-10 w-full max-w-md space-y-6 shadow-xs border-arch radius-arch"
        >
          <div className="flex items-center space-x-2">
            <span className="pulse-dot" />
            <p className="eyebrow-mono">MASJIDHUB PLATFORM CONSOLE</p>
          </div>

          <h1 className="serif text-3xl uppercase font-light tracking-tight">
            Platform Administration
          </h1>

          <p className="text-xs text-[#666666] leading-relaxed">
            Verify mosque legal applications and oversee multi-tenant availability.
          </p>

          {error && (
            <div className="p-3 border-arch border-red-300 bg-red-50 text-red-700 mono text-xs uppercase">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mono text-[9px] uppercase tracking-[0.3em] text-[#666666] block mb-1">
                OPERATOR EMAIL
              </label>
              <input
                className="input-bottom-line"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="OPERATOR@MASJIDHUB.ORG"
              />
            </div>

            <div>
              <label className="mono text-[9px] uppercase tracking-[0.3em] text-[#666666] block mb-1">
                SECURE TOKEN / PASSWORD
              </label>
              <input
                className="input-bottom-line"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button className="btn-editorial-cta w-full py-4 tracking-[0.35em]">
            AUTHENTICATE TERMINAL &rarr;
          </button>

          <div className="text-center pt-2">
            <Link href="/" className="mono text-[10px] uppercase tracking-[0.2em] text-[#666666] hover:text-[#1c1c1c]">
              &larr; Return to Public Index
            </Link>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f7f6f2] text-[#1c1c1c] overflow-x-hidden selection:bg-[#3d7068] selection:text-white">
      <div className="editorial-grid-bg" aria-hidden="true" />
      <div className="guide-line guide-line-25 hidden md:block" aria-hidden="true" />
      <div className="guide-line guide-line-50 hidden md:block" aria-hidden="true" />
      <div className="guide-line guide-line-75 hidden md:block" aria-hidden="true" />

      <header className="relative z-10 bg-white border-b-arch px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Link href="/" className="eyebrow-mono hover:underline">
                MASJIDHUB INDEX
              </Link>
              <span className="text-[#e5e4de]">/</span>
              <span className="mono text-[10px] uppercase tracking-[0.25em] text-[#666666]">
                OPERATIONS CONSOLE
              </span>
            </div>
            <h1 className="serif text-4xl uppercase font-light tracking-tight">
              Mosque Tenants
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="mono text-[10px] uppercase tracking-[0.25em] text-[#3d7068] font-bold">
              STATUS: CONNECTED
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-16">
        {error && (
          <div className="p-4 border-arch border-red-300 bg-red-50 text-red-700 mono text-xs uppercase mb-8">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {tenants.map((t) => (
            <article
              key={t.mosque_id}
              className="card-editorial bg-white p-8 border-arch radius-arch grid md:grid-cols-[1fr_auto_auto] gap-6 items-center shadow-xs"
            >
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="mono text-[10px] uppercase tracking-[0.25em] text-[#3d7068] font-bold">
                    /{t.slug}
                  </span>
                  <span className="text-[#e5e4de]">·</span>
                  <span
                    className={`mono text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 border-arch ${
                      t.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <h2 className="serif text-2xl uppercase font-light">{t.name}</h2>
                <p className="mono text-xs text-[#666666] uppercase tracking-[0.15em] mt-1">
                  {t._count.memberships} MEMBERS · {t._count.programs} PROGRAMMES · {t._count.donations} CONTRIBUTIONS
                </p>
              </div>

              <time className="mono text-xs text-[#888888] uppercase tracking-[0.15em]">
                Applied {new Date(t.created_at).toLocaleDateString()}
              </time>

              <div className="flex gap-3">
                {t.status !== 'Active' && (
                  <button
                    className="btn-editorial-cta text-[9px] py-2 px-3 tracking-[0.2em]"
                    onClick={() => status(t.mosque_id, 'Active')}
                  >
                    ACTIVATE
                  </button>
                )}
                {t.status !== 'Suspended' && (
                  <button
                    className="btn-editorial-secondary text-[9px] py-2 px-3 tracking-[0.2em]"
                    onClick={() => status(t.mosque_id, 'Suspended')}
                  >
                    SUSPEND
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
