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
  const [loading, setLoading] = useState(false);

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
    setError('');
    setLoading(true);
    try {
      const result = await api<{ token: string }>(null, '/api/platform/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('masjidhub:platform:token', result.token);
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
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
      <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
        {/* 80px Glassmorphism Header */}
        <header className="nav-glass px-8 md:px-12 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <Link href="/" className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors">
            &larr; PUBLIC INDEX
          </Link>
        </header>

        {/* Authenticate Terminal Card */}
        <main className="flex items-center justify-center p-6 py-16 flex-grow">
          <form
            onSubmit={login}
            className="bg-white max-w-md w-full p-10 rounded-[16px] border-2 border-[#c89b3c]/30 shadow-2xl relative animate-fade-in space-y-6"
          >
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
                SUPERVISION TERMINAL
              </span>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-[#0d4734]">
                PLATFORM CONSOLE
              </h1>
              <p className="text-xs text-[#1c2421]/70 mt-2 font-normal">
                Verify mosque legal applications and oversee sovereign tenant states.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Operator Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="OPERATOR@MASJIDHUB.ORG"
                  className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2.5 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Security Key / Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2.5 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-pill-cta w-full py-4 tracking-ultra-wide mt-2"
            >
              {loading ? 'AUTHENTICATING…' : 'UNLOCK CONSOLE →'}
            </button>
          </form>
        </main>

        {/* Footer */}
        <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
          &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
            PLATFORM CONSOLE
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-3 py-1 rounded-full">
            SESSION: AUTHORIZED
          </span>
          <button
            onClick={() => {
              localStorage.removeItem('masjidhub:platform:token');
              setAuthenticated(false);
            }}
            className="text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-red-800"
          >
            DISCONNECT
          </button>
        </div>
      </header>

      {/* Main Tenant Registry */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-16 flex-grow w-full space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#c89b3c]/20 pb-8">
          <div>
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
              MULTI-TENANT GOVERNANCE
            </span>
            <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter text-[#0d4734]">
              MOSQUE TENANTS
            </h1>
            <p className="text-xs sm:text-sm text-[#1c2421]/70 mt-1 font-normal">
              Review registered congregations, grant production activation, or suspend delinquent tenants.
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-[#0d4734] bg-white border border-[#c89b3c]/30 px-3.5 py-1.5 rounded-[6px] shadow-xs">
              {tenants.length} REGISTERED TENANTS
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {tenants.map((t) => (
            <article
              key={t.mosque_id}
              className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/20 shadow-xs hover:border-[#0d4734] transition-all grid md:grid-cols-[1fr_auto_auto] gap-6 items-center"
            >
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-[#0d4734]">
                    /{t.slug}
                  </span>
                  <span className="text-[#c89b3c]/40">·</span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                      t.status === 'Active'
                        ? 'bg-[#e4efe9] text-[#0d4734]'
                        : t.status === 'Pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                  {t.name}
                </h2>
                <p className="text-[11px] font-mono text-[#1c2421]/60 uppercase tracking-wider mt-1">
                  {t._count.memberships} MEMBERS • {t._count.programs} PROGRAMMES • {t._count.donations} CONTRIBUTIONS
                </p>
              </div>

              <time className="text-[10px] font-mono text-[#1c2421]/50 uppercase tracking-wider">
                Applied {new Date(t.created_at).toLocaleDateString()}
              </time>

              <div className="flex gap-2">
                {t.status !== 'Active' && (
                  <button
                    className="btn-pill-cta py-2 px-4 text-[9px] tracking-widest"
                    onClick={() => status(t.mosque_id, 'Active')}
                  >
                    ACTIVATE
                  </button>
                )}
                {t.status !== 'Suspended' && (
                  <button
                    className="btn-pill-secondary py-2 px-4 text-[9px] tracking-widest text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
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

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
