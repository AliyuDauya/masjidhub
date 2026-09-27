'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api, clearToken, setToken, API_URL } from '@/lib/api';
import NotificationCenter from '@/components/NotificationCenter';
import BackButton from '@/components/BackButton';

interface UserMe {
  user_id: number;
  name: string;
  email: string;
  phone?: string;
  memberships: Array<{
    membership_id: number;
    role: string;
    status: string;
    mosque: { mosque_id: number; slug: string; name: string; address?: string };
  }>;
}

interface Registration {
  reg_id: number;
  status: string;
  reg_date: string;
  attended_at: string | null;
  mosque?: {
    mosque_id: number;
    name: string;
    slug: string;
  };
  program: {
    program_id: number;
    title: string;
    description: string;
    category: string;
    start_date: string;
    end_date: string;
    location: string;
    max_capacity: number;
    _count?: {
      registrations: number;
    };
  };
}

interface MemberDonation {
  donation_id: number;
  receipt_number: string;
  amount: number;
  currency: string;
  category: string;
  method: string;
  status: string;
  reconciliation_status: string;
  date: string;
  mosque?: {
    mosque_id: number;
    name: string;
    slug: string;
  };
}

interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  category: string;
  audience: string;
  posted_at: string;
  expiry_date?: string | null;
}

interface Mosque {
  mosque_id: number;
  name: string;
  slug: string;
  address?: string;
  timezone: string;
}

export default function MosqueMemberDashboard() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const [activeTab, setActiveTab] = useState<'overview' | 'programs' | 'donations' | 'profile' | 'notices'>('overview');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'programs' || tabParam === 'donations' || tabParam === 'profile' || tabParam === 'overview' || tabParam === 'notices') {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);
  const [user, setUser] = useState<UserMe | null>(null);
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [allMosques, setAllMosques] = useState<Mosque[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [donations, setDonations] = useState<MemberDonation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Selected receipt for modal
  const [selectedReceipt, setSelectedReceipt] = useState<MemberDonation | null>(null);

  function notify(text: string) {
    setMessage(text);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  }

  async function loadDashboard() {
    setLoading(true);
    setError('');

    // 1. Fetch mosque details first (public)
    try {
      const m = await api<Mosque>(null, `/api/mosques/${slug}`);
      setMosque(m);
    } catch {
      // Fallback
    }

    // 2. Fetch all mosques for directory
    try {
      const ms = await api<Mosque[]>(null, '/api/mosques');
      setAllMosques(ms || []);
    } catch {
      setAllMosques([]);
    }

    // 3. Fetch authenticated member data
    try {
      const me = await api<UserMe>(slug, '/api/auth/me');
      setUser(me);

      // 4. Fetch member registrations
      try {
        const regs = await api<Registration[]>(slug, '/api/members/registrations');
        setRegistrations(regs || []);
      } catch {
        setRegistrations([]);
      }

      // 5. Fetch member donations
      try {
        const dons = await api<MemberDonation[]>(slug, '/api/members/donations');
        setDonations(dons || []);
      } catch {
        setDonations([]);
      }

      // 6. Fetch mosque announcements
      try {
        const ann = await api<Announcement[]>(slug, '/api/announcements');
        setAnnouncements(ann || []);
      } catch {
        setAnnouncements([]);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [slug]);

  async function cancelSeat(programId: number) {
    try {
      await api(slug, `/api/programs/${programId}/cancel`, { method: 'POST' });
      notify('Seat reservation cancelled. Pass updated.');
      setRegistrations((prev) =>
        prev.map((r) =>
          r.program.program_id === programId
            ? {
                ...r,
                status: 'Cancelled',
                program: {
                  ...r.program,
                  _count: {
                    registrations: Math.max(0, (r.program._count?.registrations ?? 1) - 1)
                  }
                }
              }
            : r
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel reservation.');
    }
  }

  async function joinAnotherMosque(targetSlug: string) {
    setJoiningSlug(targetSlug);
    setError('');
    try {
      const res = await api<{ success: boolean; message: string; token: string }>(
        targetSlug,
        '/api/members/join',
        { method: 'POST' }
      );
      if (res.token) {
        setToken(targetSlug, res.token);
      }
      notify(`Successfully joined ${targetSlug} congregation!`);
      const me = await api<UserMe>(slug, '/api/auth/me');
      setUser(me);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join mosque.');
    } finally {
      setJoiningSlug(null);
    }
  }

  const [scopeFilter, setScopeFilter] = useState<'all' | 'current'>('all');

  const filteredRegistrations = scopeFilter === 'all'
    ? registrations
    : registrations.filter((r) => !r.mosque?.slug || r.mosque.slug === slug);
  const activeRegistrations = filteredRegistrations.filter((r) => r.status === 'Registered');

  const filteredDonations = scopeFilter === 'all'
    ? donations
    : donations.filter((d) => !d.mosque?.slug || d.mosque.slug === slug);
  const totalGiven = filteredDonations.reduce((sum, d) => sum + (d.amount || 0), 0);

  const joinedSlugs = new Set(user?.memberships?.map((m) => m.mosque?.slug) || []);
  const availableMosquesToJoin = allMosques.filter((m) => !joinedSlugs.has(m.slug));

  const currentMembership = user?.memberships?.find((m) => m.mosque?.slug === slug && m.status === 'Active');
  const anyAdminMembership = user?.memberships?.find(
    (m) =>
      m.status === 'Active' &&
      ['tenant_admin', 'programme_officer', 'communications_officer', 'finance_officer'].includes(m.role)
  );
  const activeAdminMembership = currentMembership && ['tenant_admin', 'programme_officer', 'communications_officer', 'finance_officer'].includes(currentMembership.role)
    ? currentMembership
    : anyAdminMembership;

  const isAdminOrOfficer = Boolean(activeAdminMembership);
  const adminMosqueSlug = activeAdminMembership?.mosque?.slug || slug;
  const adminMosqueName = activeAdminMembership?.mosque?.name || mosque?.name || slug;

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Navigation Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl={`/mosque/${slug}`} />
          <Link href={`/mosque/${slug}`} className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40 hidden sm:inline">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] hidden sm:inline">
            MEMBER DASHBOARD ({slug})
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isAdminOrOfficer && (
            <Link
              href={`/mosque/${adminMosqueSlug}/admin`}
              className="btn-pill-gold py-1.5 px-3.5 text-[9px] tracking-widest font-black flex items-center gap-1.5 shadow-sm"
            >
              <span>🕌</span>
              <span>ADMIN WORKSPACE</span>
            </Link>
          )}
          <button
            onClick={loadDashboard}
            title="Refresh Dashboard & Metrics"
            className="btn-pill-secondary py-1.5 px-3 text-[9px] tracking-widest flex items-center gap-1.5"
          >
            <span>↻</span>
            <span className="hidden sm:inline">REFRESH</span>
          </button>
          <NotificationCenter slug={slug} />
          <Link
            href={`/mosque/${slug}`}
            className="text-[10px] font-black uppercase tracking-menu text-[#0d4734] hover:text-[#c89b3c] transition-colors hidden sm:inline-block"
          >
            MOSQUE PORTAL
          </Link>
          <Link
            href="/forgot-password"
            className="btn-pill-secondary py-1.5 px-3 text-[9px] tracking-widest text-[#0d4734] border border-[#c89b3c]/40 hover:bg-[#e4efe9] flex items-center gap-1"
          >
            <span>🔑</span>
            <span>RESET PASSWORD</span>
          </Link>
          <button
            onClick={() => {
              clearToken(slug);
              router.push(`/mosque/${slug}`);
            }}
            className="btn-pill-secondary py-1.5 px-4 text-[9px] tracking-widest text-red-600 hover:text-red-700"
          >
            SIGN OUT
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12 flex-grow w-full space-y-10">
        {loading ? (
          <div className="text-center py-20 bg-white rounded-[16px] border-2 border-[#c89b3c]/20 shadow-xs">
            <div className="w-10 h-10 border-4 border-[#0d4734] border-t-[#c89b3c] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-[#0d4734]">
              Loading Member Dashboard ({slug})…
            </p>
          </div>
        ) : !user ? (
          <div className="bg-white p-8 md:p-14 rounded-[20px] border-2 border-[#c89b3c]/30 shadow-xl text-center space-y-6 max-w-xl mx-auto my-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[#0d4734] text-[#c89b3c] flex items-center justify-center mx-auto text-2xl font-black shadow-md">
              👤
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                CONGREGANT ACCESS
              </span>
              <h2 className="text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                Sign In to Member Dashboard
              </h2>
              <p className="text-xs text-[#1c2421]/70 max-w-md mx-auto leading-relaxed">
                Sign in to view your registered programme passes, download official charitable tax receipts, and access your worshipper profile at <strong>{mosque?.name || slug}</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <Link
                href={`/mosque/${slug}/login`}
                className="btn-pill-cta py-3.5 px-8 text-[10px] tracking-ultra-wide"
              >
                SIGN IN TO {slug.toUpperCase()} &rarr;
              </Link>
              <Link
                href={`/mosque/${slug}/register`}
                className="btn-pill-secondary py-3.5 px-8 text-[10px] tracking-ultra-wide"
              >
                CREATE ACCOUNT
              </Link>
            </div>

            <div className="pt-4 border-t border-[#c89b3c]/20">
              <Link
                href="/login"
                className="text-[10px] font-bold uppercase text-[#c89b3c] hover:text-[#0d4734] transition-colors tracking-wider"
              >
                Global 3-Portal Login Switcher &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Member Welcome Hero Banner */}
            <div className="bg-[#0d4734] text-white p-8 md:p-12 rounded-[16px] border-2 border-[#c89b3c] shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                  AUTHENTICATED CONGREGANT PORTAL
                </span>
                <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter">
                  Welcome{user?.name ? `, ${user.name}` : ''}
                </h1>
                <p className="text-[#e4efe9] text-xs sm:text-sm font-normal max-w-xl">
                  Member at <strong>{mosque?.name || slug}</strong>. Access your registered programme passes, auditable donation receipts, and join any mosque across the platform.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {isAdminOrOfficer && (
                  <Link
                    href={`/mosque/${adminMosqueSlug}/admin`}
                    className="btn-pill-gold py-3 px-6 text-[9px] tracking-ultra-wide whitespace-nowrap border-2 border-[#c89b3c] shadow-lg flex items-center gap-1.5 font-black"
                  >
                    <span>🕌</span>
                    <span>ADMIN WORKSPACE (PRAYERS, NOTICES, ROSTER) &rarr;</span>
                  </Link>
                )}
                <Link
                  href={`/mosque/${slug}/donations`}
                  className="btn-pill-gold py-3 px-6 text-[9px] tracking-ultra-wide whitespace-nowrap"
                >
                  MAKE A DONATION
                </Link>
                <Link
                  href={`/mosque/${slug}/programs`}
                  className="btn-pill-secondary py-3 px-6 text-[9px] tracking-ultra-wide bg-white/10 text-white hover:bg-white hover:text-[#0d4734] whitespace-nowrap"
                >
                  EXPLORE CLASSES
                </Link>
                <Link
                  href="/forgot-password"
                  className="btn-pill-secondary py-3 px-6 text-[9px] tracking-ultra-wide bg-[#c89b3c]/20 text-[#c89b3c] hover:bg-[#c89b3c] hover:text-[#0d4734] whitespace-nowrap border border-[#c89b3c]"
                >
                  🔑 RESET PASSWORD
                </Link>
              </div>
            </div>

            {/* Admin Guidance Banner */}
            {isAdminOrOfficer && (
              <div className="bg-[#0d4734] border-2 border-[#c89b3c] rounded-[14px] p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#c89b3c] animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                      ADMINISTRATION PRIVILEGES DETECTED
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 uppercase text-white/90">
                      {activeAdminMembership?.role.replace('_', ' ')} &bull; {adminMosqueName}
                    </span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight text-white">
                    Need to change prayer times, post announcements, or manage finances?
                  </h4>
                  <p className="text-xs text-[#e4efe9]/80 font-normal">
                    You are in the worshipper/member view. Open your Mosque Admin Console to manage prayer schedules, community notices, programme rosters, and donations.
                  </p>
                </div>
                <Link
                  href={`/mosque/${adminMosqueSlug}/admin`}
                  className="btn-pill-gold py-2.5 px-6 text-[9px] tracking-widest font-black whitespace-nowrap shadow-md shrink-0"
                >
                  OPEN ADMIN CONSOLE &rarr;
                </Link>
              </div>
            )}

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

            {/* Federated View Scope Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[12px] bg-white border-2 border-[#c89b3c]/20 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c89b3c] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734]">
                  FEDERATED CONGREGANT SCOPE:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScopeFilter('all')}
                  className={`py-1.5 px-4 text-[9px] font-black uppercase tracking-wider rounded-full transition-all ${
                    scopeFilter === 'all'
                      ? 'bg-[#0d4734] text-[#c89b3c] border border-[#c89b3c] shadow-xs'
                      : 'bg-[#f6f3eb] text-[#1c2421]/70 hover:bg-[#e4efe9] border border-[#c89b3c]/20'
                  }`}
                >
                  ALL MY MOSQUES ({registrations.filter((r) => r.status === 'Registered').length} Passes)
                </button>
                <button
                  onClick={() => setScopeFilter('current')}
                  className={`py-1.5 px-4 text-[9px] font-black uppercase tracking-wider rounded-full transition-all ${
                    scopeFilter === 'current'
                      ? 'bg-[#0d4734] text-[#c89b3c] border border-[#c89b3c] shadow-xs'
                      : 'bg-[#f6f3eb] text-[#1c2421]/70 hover:bg-[#e4efe9] border border-[#c89b3c]/20'
                  }`}
                >
                  THIS MOSQUE ({mosque?.name || slug})
                </button>
              </div>
            </div>

            {/* Key Metrics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <button
                onClick={() => setActiveTab('programs')}
                className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 hover:border-[#0d4734] shadow-xs text-left transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                    RESERVED PASSES
                  </span>
                  <span className="text-[9px] font-black text-[#0d4734] opacity-0 group-hover:opacity-100 transition-opacity">
                    VIEW &rarr;
                  </span>
                </div>
                <p className="text-3xl font-black text-[#0d4734]">{activeRegistrations.length}</p>
                <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">
                  {scopeFilter === 'all' ? 'Across all joined mosques' : `At ${mosque?.name || slug}`}
                </p>
              </button>

              <button
                onClick={() => setActiveTab('donations')}
                className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 hover:border-[#0d4734] shadow-xs text-left transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                    TOTAL GIVEN
                  </span>
                  <span className="text-[9px] font-black text-[#0d4734] opacity-0 group-hover:opacity-100 transition-opacity">
                    LEDGER &rarr;
                  </span>
                </div>
                <p className="text-3xl font-black text-[#0d4734]">₦{totalGiven.toLocaleString()}</p>
                <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">
                  {scopeFilter === 'all' ? 'Across all joined mosques' : `At ${mosque?.name || slug}`}
                </p>
              </button>

              <button
                onClick={() => setActiveTab('donations')}
                className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 hover:border-[#0d4734] shadow-xs text-left transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                    RECEIPTS ISSUED
                  </span>
                  <span className="text-[9px] font-black text-[#0d4734] opacity-0 group-hover:opacity-100 transition-opacity">
                    VIEW &rarr;
                  </span>
                </div>
                <p className="text-3xl font-black text-[#0d4734]">{filteredDonations.length}</p>
                <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Verified tax receipts</p>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 hover:border-[#0d4734] shadow-xs text-left transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                    JOINED MOSQUES
                  </span>
                  <span className="text-[9px] font-black text-[#0d4734] opacity-0 group-hover:opacity-100 transition-opacity">
                    MANAGE &rarr;
                  </span>
                </div>
                <p className="text-3xl font-black text-[#0d4734]">{user?.memberships?.length || 1}</p>
                <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Global single sign-on</p>
              </button>
            </div>

            {/* Tab Navigation Controls */}
            <div className="flex border-b border-[#c89b3c]/20 gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('programs')}
                className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
                  activeTab === 'programs'
                    ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
                }`}
              >
                My Programme Passes ({activeRegistrations.length})
              </button>
              <button
                onClick={() => setActiveTab('donations')}
                className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
                  activeTab === 'donations'
                    ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
                }`}
              >
                My Giving & Tax Receipts ({filteredDonations.length})
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
                  activeTab === 'profile'
                    ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
                }`}
              >
                Global Profile & Mosques ({user?.memberships?.length || 1})
              </button>
              <button
                onClick={() => setActiveTab('notices')}
                className={`py-3 px-6 text-xs font-black uppercase tracking-wider rounded-t-[8px] transition-all whitespace-nowrap ${
                  activeTab === 'notices'
                    ? 'bg-[#0d4734] text-[#c89b3c] border-t-2 border-x-2 border-[#c89b3c]'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-[#f6f3eb]'
                }`}
              >
                📢 Notices & Bulletins ({announcements.length})
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Next Upcoming Class Pass */}
                  <div className="lg:col-span-7 bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                    <div className="flex justify-between items-center border-b border-[#c89b3c]/20 pb-4">
                      <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                        NEXT SCHEDULED GATHERING
                      </span>
                      <button
                        onClick={() => setActiveTab('programs')}
                        className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] hover:text-[#c89b3c]"
                      >
                        VIEW ALL PASSES ({activeRegistrations.length}) &rarr;
                      </button>
                    </div>

                    {activeRegistrations.length === 0 ? (
                      <div className="text-center py-8 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20 space-y-3">
                        <p className="text-sm font-black uppercase text-[#0d4734]">No upcoming programme passes</p>
                        <p className="text-xs text-[#1c2421]/60 max-w-sm mx-auto">
                          Explore our Islamic learning classes, halaqahs, and community circles.
                        </p>
                        <Link href={`/mosque/${slug}/programs`} className="btn-pill-cta inline-block py-2.5 px-6 text-[9px]">
                          BROWSE PROGRAMMES &rarr;
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-[#f6f3eb] p-6 rounded-[12px] border-2 border-[#c89b3c]/30 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2.5 py-1 rounded-full">
                                {activeRegistrations[0].program.category}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-white px-2.5 py-1 rounded-full border border-[#c89b3c]/30">
                                🏛️ {activeRegistrations[0].mosque?.name || slug}
                              </span>
                              <span className="text-[9px] font-mono font-bold uppercase text-[#0d4734] bg-white px-2.5 py-0.5 rounded-full border border-[#c89b3c]/30">
                                {activeRegistrations[0].program._count?.registrations ?? 1} / {activeRegistrations[0].program.max_capacity > 0 ? `${activeRegistrations[0].program.max_capacity} Seats` : 'Open'}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-[#c89b3c]">
                              ENTRY PASS #{activeRegistrations[0].reg_id}
                            </span>
                          </div>

                          <h3 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                            {activeRegistrations[0].program.title}
                          </h3>
                          <p className="text-xs text-[#1c2421]/70 leading-relaxed">
                            {activeRegistrations[0].program.description}
                          </p>

                          <div className="pt-4 border-t border-[#c89b3c]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="text-xs font-mono text-[#1c2421]/60">
                              📍 {activeRegistrations[0].program.location} • 🗓️{' '}
                              {new Date(activeRegistrations[0].program.start_date).toLocaleDateString()} at{' '}
                              {new Date(activeRegistrations[0].program.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <button
                              onClick={() => cancelSeat(activeRegistrations[0].program.program_id)}
                              className="text-[9px] font-black uppercase text-red-600 hover:underline"
                            >
                              Cancel Seat
                            </button>
                          </div>
                        </div>

                        {activeRegistrations.length > 1 && (
                          <button
                            onClick={() => setActiveTab('programs')}
                            className="btn-pill-secondary w-full py-2.5 text-[9px] tracking-widest text-center"
                          >
                            VIEW ALL {activeRegistrations.length} RESERVED PASSES &rarr;
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Recent Contribution Receipt */}
                  <div className="lg:col-span-5 bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                    <div className="flex justify-between items-center border-b border-[#c89b3c]/20 pb-4">
                      <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                        RECENT GIVING LEDGER
                      </span>
                      <Link
                        href={`/mosque/${slug}/donations`}
                        className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] hover:text-[#c89b3c]"
                      >
                        GIVE &rarr;
                      </Link>
                    </div>

                    {filteredDonations.length === 0 ? (
                      <div className="text-center py-8 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20 space-y-3">
                        <p className="text-sm font-black uppercase text-[#0d4734]">No donation history yet</p>
                        <p className="text-xs text-[#1c2421]/60 max-w-xs mx-auto">
                          Support your local mosque operations, Zakat funds, or educational circles.
                        </p>
                        <Link href={`/mosque/${slug}/donations`} className="btn-pill-gold inline-block py-2.5 px-6 text-[9px]">
                          MAKE FIRST DONATION &rarr;
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-5 rounded-[12px] bg-[#f6f3eb] border border-[#c89b3c]/20 space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase text-[#0d4734] bg-[#e4efe9] px-2 py-0.5 rounded">
                                {filteredDonations[0].category}
                              </span>
                              <span className="text-[9px] font-black uppercase text-[#0d4734] bg-white px-2 py-0.5 rounded border border-[#c89b3c]/20">
                                🏛️ {filteredDonations[0].mosque?.name || slug}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-black text-[#0d4734]">
                              ₦{filteredDonations[0].amount.toLocaleString()}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-[#1c2421]/60">
                            Receipt: {filteredDonations[0].receipt_number} • {new Date(filteredDonations[0].date).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => setSelectedReceipt(filteredDonations[0])}
                            className="text-[9px] font-black uppercase tracking-wider text-[#c89b3c] hover:underline pt-2 block"
                          >
                            VIEW OFFICIAL TAX RECEIPT &rarr;
                          </button>
                        </div>

                        {filteredDonations.length > 1 && (
                          <button
                            onClick={() => setActiveTab('donations')}
                            className="btn-pill-secondary w-full py-2.5 text-[9px] tracking-widest text-center"
                          >
                            VIEW ALL {filteredDonations.length} RECEIPTS
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Official Community Noticeboard & Dispatches */}
                <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-[#c89b3c]/20 pb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                        ADMINISTRATIVE DISPATCHES & BULLETINS
                      </span>
                      <h3 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                        Official Mosque Announcements
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono text-[#1c2421]/50 uppercase">
                        {announcements.length} Active {announcements.length === 1 ? 'Notice' : 'Notices'}
                      </span>
                      <button
                        onClick={() => setActiveTab('notices')}
                        className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] hover:text-[#c89b3c]"
                      >
                        VIEW BULLETIN BOARD &rarr;
                      </button>
                    </div>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="text-center py-8 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20 space-y-1">
                      <p className="text-xs font-black uppercase text-[#0d4734]">No active announcements posted</p>
                      <p className="text-[10px] text-[#1c2421]/50">Check back regularly for updates from mosque administration.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {announcements.map((a) => {
                        const isUrgent = a.category.toLowerCase() === 'urgent';
                        return (
                          <article
                            key={a.announcement_id}
                            className={`p-6 rounded-[12px] border-2 transition-all space-y-3 ${
                              isUrgent
                                ? 'bg-amber-50/60 border-amber-400/60 shadow-xs'
                                : 'bg-[#f6f3eb] border-[#c89b3c]/25 hover:border-[#0d4734]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                                    isUrgent
                                      ? 'bg-amber-200 text-amber-900 font-bold'
                                      : 'bg-[#e4efe9] text-[#0d4734]'
                                  }`}
                                >
                                  {a.category}
                                </span>
                                {a.audience && a.audience !== 'Public' && (
                                  <span className="text-[8px] font-mono uppercase bg-white px-2 py-0.5 rounded border border-[#c89b3c]/30 text-[#0d4734]">
                                    🔒 {a.audience} Only
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] font-mono text-[#1c2421]/50">
                                {new Date(a.posted_at).toLocaleDateString()}
                              </span>
                            </div>

                            <h4 className="text-lg font-black uppercase tracking-tight text-[#0d4734]">
                              {a.title}
                            </h4>
                            <p className="text-xs text-[#1c2421]/75 leading-relaxed font-normal whitespace-pre-line">
                              {a.content}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MY PROGRAMMES */}
            {activeTab === 'programs' && (
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                <div className="flex justify-between items-center border-b border-[#c89b3c]/20 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                      ENTRY PASSES & ATTENDANCE
                    </span>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                      My Registered Programmes
                    </h2>
                  </div>
                  <Link
                    href={`/mosque/${slug}/programs`}
                    className="btn-pill-cta py-2 px-5 text-[9px] tracking-ultra-wide"
                  >
                    + BROWSE ALL CLASSES
                  </Link>
                </div>

                {filteredRegistrations.length === 0 ? (
                  <div className="text-center py-12 bg-[#f6f3eb] rounded-[12px] border border-[#c89b3c]/20 space-y-3">
                    <p className="text-xl font-black uppercase text-[#0d4734]">You have not registered for any programmes</p>
                    <p className="text-xs text-[#1c2421]/60 max-w-md mx-auto">
                      Browse the upcoming timetable of Tafseer circles, Tajweed classes, and community youth gatherings.
                    </p>
                    <Link href={`/mosque/${slug}/programs`} className="btn-pill-cta inline-block py-3 px-8 text-[9px]">
                      RESERVE YOUR FIRST SEAT &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredRegistrations.map((r) => {
                      const isAttended = r.status === 'Attended';
                      const isCancelled = r.status === 'Cancelled';
                      return (
                        <article
                          key={r.reg_id}
                          className={`p-6 rounded-[12px] border-2 transition-all flex flex-col justify-between ${
                            isCancelled
                              ? 'bg-slate-50 border-slate-200 opacity-60'
                              : 'bg-[#f6f3eb] border-[#c89b3c]/30 hover:border-[#0d4734]'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2.5 py-0.5 rounded-full">
                                  {r.program.category}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-white px-2.5 py-0.5 rounded-full border border-[#c89b3c]/30">
                                  🏛️ {r.mosque?.name || slug}
                                </span>
                                <span className="text-[9px] font-mono font-bold uppercase text-[#0d4734] bg-white px-2 py-0.5 rounded-full border border-[#c89b3c]/30">
                                  {r.program._count?.registrations ?? 1} / {r.program.max_capacity > 0 ? `${r.program.max_capacity} Seats` : 'Open'}
                                </span>
                              </div>
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isAttended
                                    ? 'bg-emerald-100 text-emerald-900 font-bold'
                                    : isCancelled
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-[#c89b3c] text-[#0d4734]'
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>

                            <h3 className="text-xl font-black uppercase tracking-tight text-[#0d4734]">
                              {r.program.title}
                            </h3>
                            <p className="text-xs text-[#1c2421]/70 leading-relaxed">
                              {r.program.description}
                            </p>

                            <div className="font-mono text-[10px] text-[#1c2421]/60 space-y-1 pt-2">
                              <p>📍 Location: {r.program.location}</p>
                              <p>
                                🗓️ Date: {new Date(r.program.start_date).toLocaleDateString()} (
                                {new Date(r.program.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </p>
                            </div>
                          </div>

                          <div className="pt-4 mt-4 border-t border-[#c89b3c]/20 flex justify-between items-center">
                            <span className="text-[9px] font-mono text-[#1c2421]/50">
                              Pass #{r.reg_id}
                            </span>
                            {!isCancelled && (
                              <button
                                onClick={() => cancelSeat(r.program.program_id)}
                                className="text-[9px] font-black uppercase text-red-600 hover:underline"
                              >
                                Cancel Seat
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MY GIVING & TAX RECEIPTS */}
            {activeTab === 'donations' && (
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                <div className="flex justify-between items-center border-b border-[#c89b3c]/20 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                      CRYPTOGRAPHIC DONOR STEWARDSHIP
                    </span>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                      Personal Contribution Ledger
                    </h2>
                  </div>
                  <Link
                    href={`/mosque/${slug}/donations`}
                    className="btn-pill-gold py-2 px-5 text-[9px] tracking-ultra-wide"
                  >
                    + DONATE NOW
                  </Link>
                </div>

                {filteredDonations.length === 0 ? (
                  <div className="text-center py-12 bg-[#f6f3eb] rounded-[12px] border border-[#c89b3c]/20 space-y-3">
                    <p className="text-xl font-black uppercase text-[#0d4734]">No giving history recorded</p>
                    <p className="text-xs text-[#1c2421]/60 max-w-md mx-auto">
                      When you contribute Sadaqah, Zakat, or general mosque maintenance, your digital tax receipts will appear here.
                    </p>
                    <Link href={`/mosque/${slug}/donations`} className="btn-pill-gold inline-block py-3 px-8 text-[9px]">
                      CONTRIBUTE TO MOSQUE &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#c89b3c]/20 text-[#1c2421]/50 uppercase text-[9px] font-black tracking-widest">
                          <th className="py-3 px-2">Mosque Entity</th>
                          <th className="py-3 px-2">Receipt Ref</th>
                          <th className="py-3 px-2">Date</th>
                          <th className="py-3 px-2">Category</th>
                          <th className="py-3 px-2">Channel</th>
                          <th className="py-3 px-2">Amount</th>
                          <th className="py-3 px-2">Status</th>
                          <th className="py-3 px-2 text-right">Official Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDonations.map((d) => (
                          <tr key={d.donation_id} className="border-b border-[#c89b3c]/10 hover:bg-[#f6f3eb]/40">
                            <td className="py-3 px-2 font-bold text-[10px] text-[#0d4734]">
                              🏛️ {d.mosque?.name || slug}
                            </td>
                            <td className="py-3 px-2 font-mono font-bold text-xs text-[#0d4734]">{d.receipt_number}</td>
                            <td className="py-3 px-2 font-mono text-[10px] text-[#1c2421]/60">
                              {new Date(d.date).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-2">
                              <span className="px-2 py-0.5 rounded bg-[#f6f3eb] text-[10px] font-black uppercase text-[#0d4734]">
                                {d.category}
                              </span>
                            </td>
                            <td className="py-3 px-2 font-mono text-[10px] uppercase">{d.method}</td>
                            <td className="py-3 px-2 font-black text-[#0d4734]">
                              {d.currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-2">
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-[#e4efe9] text-[#0d4734]">
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <button
                                onClick={() => setSelectedReceipt(d)}
                                className="btn-pill-secondary py-1 px-3 text-[8px] tracking-widest"
                              >
                                VIEW RECEIPT
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PROFILE & MOSQUES FEDERATION */}
        {activeTab === 'profile' && user && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* User Profile Card */}
              <div className="lg:col-span-5 bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                  GLOBAL MEMBER CREDENTIALS
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                  Account Profile
                </h2>

                <div className="space-y-4 font-mono text-xs">
                  <div className="p-4 rounded-[8px] bg-[#f6f3eb] border border-[#c89b3c]/15">
                    <span className="text-[9px] uppercase text-[#1c2421]/50 block mb-1">Full Legal Name</span>
                    <span className="font-bold text-[#0d4734] text-sm">{user.name}</span>
                  </div>

                  <div className="p-4 rounded-[8px] bg-[#f6f3eb] border border-[#c89b3c]/15">
                    <span className="text-[9px] uppercase text-[#1c2421]/50 block mb-1">Sign-In Email (Global ID)</span>
                    <span className="font-bold text-[#0d4734] text-sm">{user.email}</span>
                  </div>

                  <div className="p-4 rounded-[8px] bg-[#f6f3eb] border border-[#c89b3c]/15">
                    <span className="text-[9px] uppercase text-[#1c2421]/50 block mb-1">Contact Phone</span>
                    <span className="font-bold text-[#0d4734] text-sm">{user.phone || 'None listed'}</span>
                  </div>

                  <div className="p-4 rounded-[8px] bg-[#f6f3eb] border border-[#c89b3c]/15 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase text-[#1c2421]/50 block mb-1">Password & Security</span>
                      <span className="font-bold text-[#0d4734] text-xs tracking-widest">••••••••••••</span>
                    </div>
                    <Link
                      href="/forgot-password"
                      className="btn-pill-secondary py-1 px-3 text-[8px] tracking-widest text-[#0d4734]"
                    >
                      RESET PASSWORD →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Multi-Mosque Memberships */}
              <div className="lg:col-span-7 bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                  SOVEREIGN FEDERATION
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                  My Joined Mosques ({user.memberships?.length || 1})
                </h2>
                <p className="text-xs text-[#1c2421]/70 leading-relaxed">
                  Your single account gives you membership across multiple mosques without creating multiple logins.
                </p>

                <div className="space-y-3">
                  {user.memberships?.map((m) => {
                    const isCurrent = m.mosque?.slug === slug;
                    return (
                      <div
                        key={m.membership_id}
                        className={`p-4 rounded-[10px] border-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                          isCurrent
                            ? 'bg-[#e4efe9] border-[#0d4734]'
                            : 'bg-[#f6f3eb] border-[#c89b3c]/20 hover:border-[#0d4734]'
                        }`}
                      >
                        <div>
                          <h4 className="font-black text-sm uppercase text-[#0d4734]">
                            {m.mosque?.name || m.mosque?.slug}
                          </h4>
                          <p className="font-mono text-[10px] text-[#1c2421]/60">
                            Role: {m.role.replaceAll('_', ' ')} • Status: {m.status}
                          </p>
                        </div>

                        {isCurrent ? (
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-white px-3 py-1 rounded-full border border-[#0d4734]/20">
                            ✓ ACTIVE HUB
                          </span>
                        ) : (
                          <Link
                            href={`/mosque/${m.mosque?.slug}/dashboard`}
                            className="btn-pill-secondary py-1.5 px-4 text-[8px] tracking-widest"
                          >
                            SWITCH TO THIS MOSQUE &rarr;
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Discover & 1-Click Join Other Mosques Section */}
            {availableMosquesToJoin.length > 0 && (
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                <div className="border-b border-[#c89b3c]/20 pb-4">
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                    GLOBAL EXPANSION DIRECTORY
                  </span>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                    Discover & Join Other Mosques
                  </h3>
                  <p className="text-xs text-[#1c2421]/70 leading-relaxed mt-1">
                    With your global MasjidHub account, click below to instantly join these congregations and reserve seats or contribute.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableMosquesToJoin.map((m) => (
                    <div
                      key={m.mosque_id}
                      className="p-5 rounded-[12px] bg-[#f6f3eb] border border-[#c89b3c]/25 hover:border-[#0d4734] transition-all flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#c89b3c] block mb-1">
                          /{m.slug}
                        </span>
                        <h4 className="text-lg font-black uppercase tracking-tight text-[#0d4734]">
                          {m.name}
                        </h4>
                        <p className="text-xs text-[#1c2421]/60 font-mono mt-1">
                          📍 {m.address || 'Address unlisted'}
                        </p>
                      </div>

                      <button
                        onClick={() => joinAnotherMosque(m.slug)}
                        disabled={joiningSlug === m.slug}
                        className="btn-pill-cta py-2 px-4 text-[9px] tracking-widest w-full text-center"
                      >
                        {joiningSlug === m.slug ? 'JOINING…' : '+ 1-CLICK JOIN MOSQUE'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

            {/* TAB 5: NOTICES & BULLETINS */}
            {activeTab === 'notices' && (
              <div className="space-y-6">
                <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#c89b3c]/20 pb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                        COMMUNITY NOTICEBOARD & BROADCASTS
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                        Official Notices ({announcements.length})
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono text-[#1c2421]/60 uppercase bg-[#f6f3eb] px-3 py-1.5 rounded border border-[#c89b3c]/20">
                      Live for {mosque?.name || slug}
                    </span>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="text-center py-12 bg-[#f6f3eb] rounded-[12px] border border-[#c89b3c]/20 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#e4efe9] text-[#0d4734] flex items-center justify-center mx-auto text-xl font-black">
                        📢
                      </div>
                      <p className="text-sm font-black uppercase text-[#0d4734]">No active notices posted</p>
                      <p className="text-xs text-[#1c2421]/60 max-w-md mx-auto">
                        Official communications, prayer timetable changes, and event notices will appear here as soon as published by administration.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {announcements.map((a) => {
                        const isUrgent = a.category === 'Urgent';
                        return (
                          <article
                            key={a.announcement_id}
                            className={`p-6 rounded-[12px] border-2 transition-all flex flex-col justify-between ${
                              isUrgent
                                ? 'bg-red-50/60 border-red-300 shadow-sm'
                                : 'bg-[#fcfbfa] border-[#c89b3c]/25 hover:border-[#0d4734]'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                    isUrgent
                                      ? 'bg-red-600 text-white'
                                      : a.category === 'Prayer'
                                      ? 'bg-[#0d4734] text-[#c89b3c]'
                                      : a.category === 'Event'
                                      ? 'bg-[#c89b3c] text-[#0d4734]'
                                      : 'bg-[#e4efe9] text-[#0d4734]'
                                  }`}
                                >
                                  {a.category}
                                </span>
                                <time className="text-[10px] font-mono text-[#1c2421]/60">
                                  {new Date(a.posted_at).toLocaleDateString([], {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </time>
                              </div>

                              <h3 className="text-lg font-black uppercase tracking-tight text-[#0d4734] leading-snug">
                                {a.title}
                              </h3>

                              <p className="text-xs text-[#1c2421]/80 leading-relaxed font-normal whitespace-pre-line">
                                {a.content}
                              </p>
                            </div>

                            {a.expiry_date && (
                              <div className="mt-4 pt-3 border-t border-[#c89b3c]/15 text-[9px] font-mono text-[#1c2421]/50">
                                Active through: {new Date(a.expiry_date).toLocaleDateString()}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
      </>
    )}
  </main>

  {/* Official Tax Receipt Modal Popup */}
  {selectedReceipt && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white max-w-md w-full p-8 rounded-[16px] border-2 border-[#c89b3c] shadow-2xl relative space-y-6">
        <button
          onClick={() => setSelectedReceipt(null)}
          className="absolute top-6 right-6 text-xs font-black uppercase tracking-widest text-[#1c2421]/50 hover:text-[#1c2421]"
        >
          [CLOSE ×]
        </button>

        <div className="text-center border-b border-[#c89b3c]/20 pb-4">
          <span className="w-10 h-10 rounded-full bg-[#e4efe9] text-[#0d4734] flex items-center justify-center mx-auto mb-2 font-black text-lg">
            ✓
          </span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
            OFFICIAL DONOR RECORD
          </span>
          <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0d4734]">
            CHARITABLE TAX RECEIPT
          </h3>
        </div>

        <div className="space-y-3 font-mono text-xs text-[#1c2421]/80">
          <div className="flex justify-between py-1.5 border-b border-[#c89b3c]/15">
            <span className="text-[#1c2421]/50 uppercase">Receipt No:</span>
            <span className="font-bold text-[#0d4734]">{selectedReceipt.receipt_number}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[#c89b3c]/15">
            <span className="text-[#1c2421]/50 uppercase">Mosque Entity:</span>
            <span className="font-bold">{selectedReceipt.mosque?.name || mosque?.name || slug}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[#c89b3c]/15">
            <span className="text-[#1c2421]/50 uppercase">Donor Name:</span>
            <span className="font-bold">{user?.name || 'Congregant'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[#c89b3c]/15">
            <span className="text-[#1c2421]/50 uppercase">Contribution:</span>
            <span className="font-bold text-[#0d4734]">
              {selectedReceipt.currency} {selectedReceipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[#c89b3c]/15">
            <span className="text-[#1c2421]/50 uppercase">Category:</span>
            <span className="font-bold">{selectedReceipt.category}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[#c89b3c]/15">
            <span className="text-[#1c2421]/50 uppercase">Payment Channel:</span>
            <span className="font-bold">{selectedReceipt.method}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[#1c2421]/50 uppercase">Issuance Date:</span>
            <span className="font-bold">{new Date(selectedReceipt.date).toLocaleString()}</span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <a
            href={`${API_URL}/api/donations/${selectedReceipt.receipt_number}/receipt.pdf`}
            target="_blank"
            rel="noreferrer"
            className="btn-pill-cta flex-1 py-3 text-[9px] tracking-ultra-wide text-center"
          >
            DOWNLOAD OFFICIAL PDF &darr;
          </a>
          <button
            onClick={() => window.print()}
            className="btn-pill-secondary py-3 px-4 text-[9px] tracking-ultra-wide"
          >
            PRINT
          </button>
        </div>
      </div>
    </div>
  )}

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
