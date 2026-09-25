'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import BackButton from '@/components/BackButton';

interface Tenant {
  mosque_id: number;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  status: string;
  created_at: string;
  _count: { memberships: number; donations: number; programs: number };
}

interface PlatformMetrics {
  tenants: Array<{ status: string; _count: number }>;
  users: number;
  memberships: number;
  auditEvents: number;
  donations?: number;
  programs?: number;
}

interface PlatformAuditEvent {
  audit_id: number;
  action: string;
  target_type: string;
  target_id?: string | number | null;
  summary: string;
  ip_address?: string | null;
  request_id?: string | null;
  created_at: string;
  actor?: { name: string; email: string } | null;
  mosque?: { name: string; slug: string } | null;
}

interface PlatformUser {
  user_id: number;
  name: string;
  email: string;
  phone?: string | null;
  platform_role?: string | null;
  account_status?: string | null;
  created_at: string;
  memberships: Array<{
    membership_id: number;
    role: string;
    status: string;
    mosque: { name: string; slug: string };
  }>;
}

export type PlatformTab = 'tenants' | 'metrics' | 'audit' | 'users';

export default function PlatformConsole() {
  const [activeTab, setActiveTab] = useState<PlatformTab>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [auditEvents, setAuditEvents] = useState<PlatformAuditEvent[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Suspended'>('All');
  const [userSearch, setUserSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('');

  function notify(msg: string) {
    setMessage(msg);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  }

  async function loadAllData() {
    try {
      const [tData, mData, aData, uData] = await Promise.all([
        api<Tenant[]>(null, '/api/platform/tenants'),
        api<PlatformMetrics>(null, '/api/platform/metrics').catch(() => null),
        api<PlatformAuditEvent[]>(null, '/api/platform/audit-events').catch(() => []),
        api<PlatformUser[]>(null, '/api/platform/users').catch(() => [])
      ]);
      setTenants(tData || []);
      setMetrics(mData);
      setAuditEvents(aData || []);
      setUsers(uData || []);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
  }

  useEffect(() => {
    loadAllData();
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
      await loadAllData();
      notify('Platform Operator session authorized.');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, value: string, tenantName: string) {
    try {
      await api(null, `/api/platform/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: value }),
      });
      notify(`Tenant "${tenantName}" state transitioned to ${value}.`);
      await loadAllData();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Status could not be changed.');
    }
  }

  // Filtered lists
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter((u) => {
    return (
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.phone && u.phone.includes(userSearch))
    );
  });

  const filteredAuditEvents = auditEvents.filter((ev) => {
    if (!auditFilter) return true;
    const q = auditFilter.toLowerCase();
    return (
      ev.action.toLowerCase().includes(q) ||
      ev.summary.toLowerCase().includes(q) ||
      (ev.actor?.email && ev.actor.email.toLowerCase().includes(q)) ||
      (ev.mosque?.name && ev.mosque.name.toLowerCase().includes(q))
    );
  });

  const activeTenantsCount = tenants.filter((t) => t.status === 'Active').length;
  const pendingTenantsCount = tenants.filter((t) => t.status === 'Pending').length;
  const suspendedTenantsCount = tenants.filter((t) => t.status === 'Suspended').length;

  if (!authenticated) {
    return (
      <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
        {/* Header */}
        <header className="nav-glass px-8 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton fallbackUrl="/" />
            <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
              <span>MASJIDHUB</span>
            </Link>
          </div>
          <Link href="/" className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors">
            PUBLIC INDEX &rarr;
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
                Verify mosque legal applications, manage multi-tenant federation, and audit platform security.
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
                  placeholder="SUPERADMIN@MASJIDHUB.ORG"
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#0d4734]"
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
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold tracking-wider focus:outline-none focus:border-[#0d4734]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-pill-cta w-full py-4 tracking-ultra-wide mt-2 text-[10px]"
            >
              {loading ? 'AUTHENTICATING…' : 'UNLOCK ROOT CONSOLE →'}
            </button>

            <div className="pt-2 text-center">
              <Link href="/login" className="text-[9px] font-bold uppercase tracking-wider text-[#c89b3c] hover:underline">
                &larr; Switch to Mosque Login Portal
              </Link>
            </div>
          </form>
        </main>

        {/* Footer */}
        <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
          &copy; {new Date().getFullYear()} MASJIDHUB MULTI-TENANT PLATFORM. SOVEREIGN OPERATIONS.
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/" />
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
            ROOT PLATFORM CONSOLE
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-3 py-1 rounded-full border border-[#0d4734]/20 hidden sm:inline">
            ROOT OPERATOR AUTHORIZED
          </span>
          <button
            onClick={() => {
              localStorage.removeItem('masjidhub:platform:token');
              setAuthenticated(false);
            }}
            className="btn-pill-secondary py-1.5 px-4 text-[9px] tracking-widest text-red-700 hover:bg-red-50 hover:border-red-300"
          >
            DISCONNECT
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 flex-grow w-full space-y-8">
        {/* Welcome Hero Banner */}
        <div className="bg-[#0d4734] text-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c] shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              SOVEREIGN MULTI-TENANT ARCHITECTURE
            </span>
            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter">
              Platform Administration
            </h1>
            <p className="text-[#e4efe9] text-xs sm:text-sm font-normal max-w-xl">
              Global governance portal. Oversee mosque onboarding, review tenant activation lifecycles, and monitor sovereign federation health.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              target="_blank"
              className="btn-pill-gold py-3 px-6 text-[9px] tracking-ultra-wide whitespace-nowrap"
            >
              EXPLORE PUBLIC PLATFORM ↗
            </Link>
          </div>
        </div>

        {/* Top KPI Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs space-y-1">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              REGISTERED MOSQUES
            </span>
            <p className="text-3xl font-black text-[#0d4734]">{tenants.length}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/60 uppercase">
              {activeTenantsCount} Active • {pendingTenantsCount} Pending • {suspendedTenantsCount} Suspended
            </p>
          </div>

          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs space-y-1">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              GLOBAL CONGREGANTS
            </span>
            <p className="text-3xl font-black text-[#0d4734]">{metrics?.users || users.length}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/60 uppercase">Single Sign-On Accounts</p>
          </div>

          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs space-y-1">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              FEDERATED PASSES
            </span>
            <p className="text-3xl font-black text-[#0d4734]">{metrics?.memberships || 0}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/60 uppercase">Cross-Mosque Links</p>
          </div>

          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs space-y-1">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              AUDIT TRAIL EVENTS
            </span>
            <p className="text-3xl font-black text-[#0d4734]">{metrics?.auditEvents || auditEvents.length}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/60 uppercase">Immutable Security Logs</p>
          </div>
        </div>

        {/* Message / Error Alerts */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
            {error}
          </div>
        )}
        {message && (
          <div className="p-4 bg-[#e4efe9] border border-[#0d4734] text-[#0d4734] text-xs font-bold uppercase rounded-[6px]">
            {message}
          </div>
        )}

        {/* Tab Switcher Controls */}
        <div className="flex border-b border-[#c89b3c]/20 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
              activeTab === 'tenants'
                ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
            }`}
          >
            🏛️ Mosque Tenants ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
              activeTab === 'metrics'
                ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
            }`}
          >
            📊 System Health & Telemetry
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
            }`}
          >
            🔒 Sovereign Audit Trail ({auditEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
            }`}
          >
            👥 Global Users ({users.length})
          </button>
        </div>

        {/* TAB 1: MOSQUE TENANTS */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-80">
                <input
                  type="text"
                  placeholder="SEARCH BY MOSQUE NAME OR SLUG…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                {(['All', 'Active', 'Pending', 'Suspended'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`py-1.5 px-4 rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      statusFilter === s
                        ? 'bg-[#0d4734] text-[#c89b3c] border border-[#c89b3c]'
                        : 'bg-[#f6f3eb] text-[#1c2421]/70 hover:bg-[#e4efe9] border border-[#c89b3c]/20'
                    }`}
                  >
                    {s} ({s === 'All' ? tenants.length : tenants.filter((t) => t.status === s).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Tenant Cards List */}
            <div className="space-y-4">
              {filteredTenants.map((t) => (
                <article
                  key={t.mosque_id}
                  className="bg-white p-6 md:p-8 rounded-[16px] border-2 border-[#c89b3c]/20 shadow-xs hover:border-[#0d4734] transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-[#0d4734] font-mono">
                        /{t.slug}
                      </span>
                      <span className="text-[#c89b3c]/40">•</span>
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
                      {t.timezone && (
                        <span className="text-[9px] font-mono text-[#1c2421]/50 bg-[#f6f3eb] px-2 py-0.5 rounded border border-[#c89b3c]/20">
                          🕒 {t.timezone}
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                      {t.name}
                    </h2>

                    <p className="text-xs text-[#1c2421]/70 font-normal">
                      📍 {t.address || 'Address unlisted'} {t.phone && `• 📞 ${t.phone}`} {t.email && `• ✉️ ${t.email}`}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-[10px] font-mono text-[#1c2421]/60 uppercase">
                      <span>👥 {t._count?.memberships || 0} Congregants</span>
                      <span>•</span>
                      <span>📖 {t._count?.programs || 0} Programmes</span>
                      <span>•</span>
                      <span>💳 {t._count?.donations || 0} Donations</span>
                      <span>•</span>
                      <span>🗓️ Registered {new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Link
                      href={`/mosque/${t.slug}`}
                      className="btn-pill-secondary py-2 px-4 text-[9px] tracking-widest whitespace-nowrap"
                    >
                      PUBLIC PORTAL ↗
                    </Link>
                    <Link
                      href={`/mosque/${t.slug}/admin`}
                      className="btn-pill-secondary py-2 px-4 text-[9px] tracking-widest whitespace-nowrap"
                    >
                      ADMIN WORKSPACE ↗
                    </Link>

                    {t.status !== 'Active' ? (
                      <button
                        onClick={() => updateStatus(t.mosque_id, 'Active', t.name)}
                        className="btn-pill-cta py-2 px-5 text-[9px] tracking-widest whitespace-nowrap"
                      >
                        ✓ ACTIVATE
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus(t.mosque_id, 'Suspended', t.name)}
                        className="btn-pill-secondary py-2 px-5 text-[9px] tracking-widest text-red-700 hover:bg-red-50 hover:border-red-400 whitespace-nowrap"
                      >
                        SUSPEND TENANT
                      </button>
                    )}
                  </div>
                </article>
              ))}

              {filteredTenants.length === 0 && (
                <div className="p-12 text-center bg-white rounded-[16px] border-2 border-[#c89b3c]/20 space-y-2">
                  <p className="text-sm font-black uppercase text-[#0d4734]">No matching mosques found</p>
                  <p className="text-xs text-[#1c2421]/50">Try adjusting your search query or status filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: METRICS & HEALTH */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
              <div className="border-b border-[#c89b3c]/20 pb-4">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                  REAL-TIME PLATFORM TELEMETRY
                </span>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                  Federation Architecture Health
                </h2>
                <p className="text-xs text-[#1c2421]/70 mt-1">
                  Global telemetry across all registered mosques, congregant single sign-on pools, and auditable financial transactions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-[12px] bg-[#f6f3eb] border border-[#c89b3c]/20 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0d4734] block">
                    DATABASE CONNECTION
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-lg font-black text-[#0d4734]">HEALTHY & ONLINE</span>
                  </div>
                  <p className="text-[10px] font-mono text-[#1c2421]/60">
                    SQLite / Prisma ORM connection active with multi-tenant domain isolation.
                  </p>
                </div>

                <div className="p-6 rounded-[12px] bg-[#f6f3eb] border border-[#c89b3c]/20 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0d4734] block">
                    TOTAL FINANCIAL LEDGER
                  </span>
                  <div className="text-2xl font-black text-[#0d4734]">
                    {metrics?.donations || 0} Recorded Donations
                  </div>
                  <p className="text-[10px] font-mono text-[#1c2421]/60">
                    Fully auditable digital and manual cash entries across all active mosques.
                  </p>
                </div>

                <div className="p-6 rounded-[12px] bg-[#f6f3eb] border border-[#c89b3c]/20 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0d4734] block">
                    ACTIVE LEARNING CIRCLES
                  </span>
                  <div className="text-2xl font-black text-[#0d4734]">
                    {metrics?.programs || 0} Programmes Hosted
                  </div>
                  <p className="text-[10px] font-mono text-[#1c2421]/60">
                    Islamic classes, halaqahs, and prayer circles registered with capacity tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#c89b3c]/20 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                    IMMUTABLE SYSTEM RECORD
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                    Platform Security & Audit Stream
                  </h2>
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="FILTER AUDIT LOGS…"
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-1.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#c89b3c]/20 text-[#1c2421]/50 uppercase text-[9px] font-black tracking-widest">
                      <th className="py-3 px-2">Timestamp</th>
                      <th className="py-3 px-2">Mosque / Scope</th>
                      <th className="py-3 px-2">Actor</th>
                      <th className="py-3 px-2">Action</th>
                      <th className="py-3 px-2">Summary</th>
                      <th className="py-3 px-2">IP / Request ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditEvents.map((ev) => (
                      <tr key={ev.audit_id} className="border-b border-[#c89b3c]/10 hover:bg-[#f6f3eb]/40">
                        <td className="py-3 px-2 font-mono text-[10px] text-[#1c2421]/60 whitespace-nowrap">
                          {new Date(ev.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-2 font-black text-[#0d4734] uppercase">
                          {ev.mosque?.name || 'Platform Core'}
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-bold text-[#0d4734]">{ev.actor?.name || 'System'}</span>
                          <small className="block font-mono text-[9px] text-[#1c2421]/50">{ev.actor?.email || ''}</small>
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-[#e4efe9] text-[#0d4734]">
                            {ev.action}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-[#1c2421]/80 max-w-sm">{ev.summary}</td>
                        <td className="py-3 px-2 font-mono text-[9px] text-[#1c2421]/50">
                          <div>{ev.ip_address || '—'}</div>
                          <div className="truncate max-w-[120px]">{ev.request_id || ''}</div>
                        </td>
                      </tr>
                    ))}
                    {filteredAuditEvents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs font-mono uppercase text-[#1c2421]/50">
                          No audit events recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GLOBAL USERS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#c89b3c]/20 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                    FEDERATED IDENTITY POOL
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                    Global Congregants Directory ({users.length})
                  </h2>
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="SEARCH USERS BY NAME/EMAIL…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-1.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#c89b3c]/20 text-[#1c2421]/50 uppercase text-[9px] font-black tracking-widest">
                      <th className="py-3 px-2">Name & Email</th>
                      <th className="py-3 px-2">Contact</th>
                      <th className="py-3 px-2">Platform Role</th>
                      <th className="py-3 px-2">Joined Mosques</th>
                      <th className="py-3 px-2">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.user_id} className="border-b border-[#c89b3c]/10 hover:bg-[#f6f3eb]/40">
                        <td className="py-3 px-2">
                          <strong className="font-bold text-[#0d4734]">{u.name}</strong>
                          <small className="block font-mono text-[10px] text-[#1c2421]/60">{u.email}</small>
                        </td>
                        <td className="py-3 px-2 font-mono text-[10px] text-[#1c2421]/70">
                          {u.phone || 'None listed'}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              u.platform_role === 'super_admin'
                                ? 'bg-[#0d4734] text-[#c89b3c]'
                                : 'bg-[#f6f3eb] text-[#0d4734]'
                            }`}
                          >
                            {u.platform_role || 'Congregant'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.memberships?.map((m) => (
                              <span
                                key={m.membership_id}
                                className="px-2 py-0.5 rounded bg-[#f6f3eb] text-[9px] font-black uppercase text-[#0d4734] border border-[#c89b3c]/20"
                              >
                                {m.mosque?.name || m.mosque?.slug} ({m.role.replace('_', ' ')})
                              </span>
                            ))}
                            {(!u.memberships || u.memberships.length === 0) && (
                              <span className="text-[10px] font-mono text-[#1c2421]/40">None</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 font-mono text-[10px] text-[#1c2421]/50">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs font-mono uppercase text-[#1c2421]/50">
                          No users found matching search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB MULTI-TENANT PLATFORM. SOVEREIGN OPERATIONS.
      </footer>
    </div>
  );
}
