'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, clearToken, setToken } from '@/lib/api';
import NotificationCenter from '@/components/NotificationCenter';

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
  program: {
    program_id: number;
    title: string;
    description: string;
    category: string;
    start_date: string;
    end_date: string;
    location: string;
    max_capacity: number;
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
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const [activeTab, setActiveTab] = useState<'overview' | 'programs' | 'donations' | 'profile'>('overview');
  const [user, setUser] = useState<UserMe | null>(null);
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [allMosques, setAllMosques] = useState<Mosque[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [donations, setDonations] = useState<MemberDonation[]>([]);
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
    try {
      // 1. Fetch current authenticated member
      const me = await api<UserMe>(slug, '/api/auth/me');
      setUser(me);

      // 2. Fetch mosque details
      const m = await api<Mosque>(null, `/api/mosques/${slug}`);
      setMosque(m);

      // 3. Fetch all mosques for global joining directory
      try {
        const ms = await api<Mosque[]>(null, '/api/mosques');
        setAllMosques(ms || []);
      } catch {
        setAllMosques([]);
      }

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load member dashboard.');
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
      notify('Seat reservation cancelled.');
      setRegistrations((prev) =>
        prev.map((r) => (r.program.program_id === programId ? { ...r, status: 'Cancelled' } : r))
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

  const activeRegistrations = registrations.filter((r) => r.status === 'Registered');
  const totalGiven = donations.reduce((sum, d) => sum + (d.amount || 0), 0);

  const joinedSlugs = new Set(user?.memberships?.map((m) => m.mosque?.slug) || []);
  const availableMosquesToJoin = allMosques.filter((m) => !joinedSlugs.has(m.slug));

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Navigation Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href={`/mosque/${slug}`} className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40 hidden sm:inline">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] hidden sm:inline">
            MEMBER DASHBOARD ({slug})
          </span>
        </div>

        <div className="flex items-center gap-4">
          <NotificationCenter slug={slug} />
          <Link
            href={`/mosque/${slug}`}
            className="text-[10px] font-black uppercase tracking-menu text-[#0d4734] hover:text-[#c89b3c] transition-colors hidden sm:inline-block"
          >
            MOSQUE PORTAL
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

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
              RESERVED PASSES
            </span>
            <p className="text-3xl font-black text-[#0d4734]">{activeRegistrations.length}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Active learning circles</p>
          </div>

          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
              TOTAL GIVEN
            </span>
            <p className="text-3xl font-black text-[#0d4734]">₦{totalGiven.toLocaleString()}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Across Zakat & Sadaqah</p>
          </div>

          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
              RECEIPTS ISSUED
            </span>
            <p className="text-3xl font-black text-[#0d4734]">{donations.length}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Verified tax receipts</p>
          </div>

          <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
              JOINED MOSQUES
            </span>
            <p className="text-3xl font-black text-[#0d4734]">{user?.memberships?.length || 1}</p>
            <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Global single sign-on</p>
          </div>
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
            My Giving & Tax Receipts ({donations.length})
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
                  <Link
                    href={`/mosque/${slug}/programs`}
                    className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] hover:text-[#c89b3c]"
                  >
                    VIEW ALL &rarr;
                  </Link>
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
                  <div className="bg-[#f6f3eb] p-6 rounded-[12px] border-2 border-[#c89b3c]/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2.5 py-1 rounded-full">
                        {activeRegistrations[0].program.category}
                      </span>
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

                {donations.length === 0 ? (
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
                        <span className="text-[10px] font-black uppercase text-[#0d4734] bg-[#e4efe9] px-2 py-0.5 rounded">
                          {donations[0].category}
                        </span>
                        <span className="font-mono text-xs font-black text-[#0d4734]">
                          ₦{donations[0].amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-[#1c2421]/60">
                        Receipt: {donations[0].receipt_number} • {new Date(donations[0].date).toLocaleDateString()}
                      </p>
                      <button
                        onClick={() => setSelectedReceipt(donations[0])}
                        className="text-[9px] font-black uppercase tracking-wider text-[#c89b3c] hover:underline pt-2 block"
                      >
                        VIEW OFFICIAL TAX RECEIPT &rarr;
                      </button>
                    </div>

                    {donations.length > 1 && (
                      <button
                        onClick={() => setActiveTab('donations')}
                        className="btn-pill-secondary w-full py-2.5 text-[9px] tracking-widest text-center"
                      >
                        VIEW ALL {donations.length} RECEIPTS
                      </button>
                    )}
                  </div>
                )}
              </div>
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

            {registrations.length === 0 ? (
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
                {registrations.map((r) => {
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
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2.5 py-0.5 rounded-full">
                            {r.program.category}
                          </span>
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

            {donations.length === 0 ? (
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
                    {donations.map((d) => (
                      <tr key={d.donation_id} className="border-b border-[#c89b3c]/10 hover:bg-[#f6f3eb]/40">
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
                <span className="font-bold">{mosque?.name || slug}</span>
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

            <div className="pt-2">
              <button
                onClick={() => window.print()}
                className="btn-pill-cta w-full py-3 text-[9px] tracking-ultra-wide"
              >
                PRINT / SAVE RECEIPT PDF
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
