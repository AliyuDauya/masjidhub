'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import NotificationCenter from '@/components/NotificationCenter';
import BackButton from '@/components/BackButton';

interface Mosque {
  name: string;
  slug: string;
  status: string;
  address?: string;
  brand_color: string;
  timezone: string;
  fajr_time?: string;
  dhuhr_time?: string;
  asr_time?: string;
  maghrib_time?: string;
  isha_time?: string;
  jumua_time?: string;
}

interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  category: string;
  posted_at: string;
}

interface UserMe {
  user_id: number;
  name: string;
  email: string;
  memberships: Array<{
    membership_id: number;
    role: string;
    status: string;
    mosque: { mosque_id: number; slug: string; name: string };
  }>;
}

export default function MosquePortal() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentUser, setCurrentUser] = useState<UserMe | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // 1. Fetch mosque info
    api<Mosque>(null, `/api/mosques/${slug}`)
      .then(setMosque)
      .catch((e) => setError(e.message));

    // 2. Fetch announcements
    api<Announcement[]>(slug, '/api/announcements')
      .then(setAnnouncements)
      .catch((e) => setError(e.message));

    // 3. Fetch current authenticated user if logged in
    api<UserMe>(slug, '/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, [slug]);

  const currentMosqueMembership = currentUser?.memberships?.find(
    (m) => m.mosque?.slug === slug && m.status === 'Active'
  );
  const isAdminOrOfficer = Boolean(
    currentMosqueMembership &&
      ['tenant_admin', 'programme_officer', 'communications_officer', 'finance_officer'].includes(
        currentMosqueMembership.role
      )
  );

  const isMemberOfCurrentMosque = Boolean(currentMosqueMembership);

  async function handleOneClickJoin() {
    if (!currentUser) {
      router.push(`/mosque/${slug}/register`);
      return;
    }
    setIsJoining(true);
    setError('');
    try {
      const res = await api<{ success: boolean; message: string; token: string }>(
        slug,
        '/api/members/join',
        { method: 'POST' }
      );
      if (res.token) {
        setToken(slug, res.token);
      }
      setJoinSuccess(`You have joined ${mosque?.name || slug} congregation!`);
      // Refresh user memberships
      const me = await api<UserMe>(slug, '/api/auth/me');
      setCurrentUser(me);
      setTimeout(() => {
        router.push(`/mosque/${slug}/dashboard`);
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join mosque.');
    } finally {
      setIsJoining(false);
    }
  }

  const prayerTimes = [
    ['Fajr', mosque?.fajr_time || '05:15 AM'],
    ['Dhuhr', mosque?.dhuhr_time || '01:00 PM'],
    ['Asr', mosque?.asr_time || '04:30 PM'],
    ['Maghrib', mosque?.maghrib_time || '07:15 PM'],
    ['Isha', mosque?.isha_time || '08:30 PM'],
    ['Jumu\'ah', mosque?.jumua_time || '01:30 PM'],
  ];


  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Navigation Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/" />
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40 hidden sm:inline">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] hidden sm:inline">
            {slug}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationCenter slug={slug} />
          {currentUser ? (
            <div className="flex items-center gap-3">
              {isAdminOrOfficer && (
                <Link
                  href={`/mosque/${slug}/admin`}
                  className="btn-pill-gold py-2 px-4 text-[9px] tracking-ultra-wide flex items-center gap-1.5 font-black shadow-sm"
                >
                  <span>🕌</span>
                  <span>ADMIN WORKSPACE</span>
                </Link>
              )}
              <Link
                href={`/mosque/${slug}/dashboard`}
                className="btn-pill-cta py-2 px-5 text-[9px] tracking-ultra-wide"
              >
                MEMBER DASHBOARD
              </Link>
              <Link
                href="/forgot-password"
                className="btn-pill-secondary py-2 px-4 text-[9px] tracking-ultra-wide text-[#0d4734] border border-[#c89b3c]/40 hover:bg-[#e4efe9] flex items-center gap-1"
              >
                <span>🔑</span>
                <span>RESET PASSWORD</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/forgot-password"
                className="text-[9px] font-bold uppercase tracking-wider text-[#c89b3c] hover:text-[#0d4734] transition-colors hidden sm:inline"
              >
                Forgot Password?
              </Link>
              <Link
                href={`/mosque/${slug}/login`}
                className="btn-pill-secondary py-2.5 px-5 text-[9px] tracking-ultra-wide"
              >
                SIGN IN
              </Link>
              <Link
                href={`/mosque/${slug}/register`}
                className="btn-pill-cta py-2.5 px-5 text-[9px] tracking-ultra-wide"
              >
                JOIN MOSQUE
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Mosque Banner Hero */}
      <section className="bg-[#f6f3eb] border-b border-[#c89b3c]/20 py-16 px-8 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                VERIFIED SOVEREIGN TENANT
              </span>
              {isMemberOfCurrentMosque && (
                <span className="text-[9px] font-black uppercase tracking-widest bg-[#e4efe9] text-[#0d4734] px-2.5 py-0.5 rounded-full border border-[#0d4734]/20">
                  ✓ CONGREGATION MEMBER
                </span>
              )}
            </div>
            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter text-[#0d4734]">
              {mosque?.name || 'LOADING MOSQUE…'}
            </h1>
            <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[#1c2421]/60 mt-2">
              📍 {mosque?.address || 'Address unlisted'} • TIMEZONE: {mosque?.timezone || 'Africa/Lagos'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {currentUser && !isMemberOfCurrentMosque && (
              <button
                onClick={handleOneClickJoin}
                disabled={isJoining}
                className="btn-pill-gold py-3 px-6 text-[9px] tracking-ultra-wide"
              >
                {isJoining ? 'JOINING MOSQUE…' : '+ 1-CLICK JOIN THIS MOSQUE'}
              </button>
            )}

            <Link
              href={`/mosque/${slug}/dashboard`}
              className="btn-pill-cta py-3 px-6 text-[9px] tracking-ultra-wide"
            >
              OPEN MEMBER DASHBOARD
            </Link>
            <Link
              href={`/mosque/${slug}/donations`}
              className="btn-pill-gold py-3 px-6 text-[9px] tracking-ultra-wide"
            >
              GIVE SADAQAH / ZAKAT
            </Link>
            <Link
              href={`/mosque/${slug}/programs`}
              className="btn-pill-secondary py-3 px-6 text-[9px] tracking-ultra-wide"
            >
              BROWSE CLASSES
            </Link>
          </div>
        </div>

        {/* Global Join Success Alert */}
        {joinSuccess && (
          <div className="max-w-7xl mx-auto mt-6 p-4 bg-[#e4efe9] border border-[#0d4734] text-[#0d4734] text-xs font-bold uppercase rounded-[8px] animate-fade-in">
            ✓ {joinSuccess} Opening your Member Dashboard…
          </div>
        )}
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-16 flex-grow w-full space-y-16">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
            {error}
          </div>
        )}

        {/* Prayer Times Grid */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-[#c89b3c]/20 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                PRAYER SYNCHRONICITY
              </span>
              <h2 className="text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                Daily Iqamah Timetable
              </h2>
            </div>
            <p className="text-[10px] font-mono uppercase text-[#1c2421]/60">
              Live Verified Synchronization
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {prayerTimes.map(([name, time]) => (
              <div
                key={name}
                className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/25 hover:border-[#0d4734] transition-all shadow-xs text-center space-y-2 group"
              >
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block group-hover:text-[#0d4734] transition-colors">
                  {name}
                </span>
                <p className="text-2xl sm:text-3xl font-black text-[#0d4734] tracking-tight">
                  {time}
                </p>
                <span className="text-[9px] font-mono text-[#1c2421]/40 block uppercase">
                  Congregation Iqamah
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Action Blocks: Stewardship & Programmes */}
        <section className="grid md:grid-cols-2 gap-8">
          {/* Stewardship Card */}
          <div className="service-card rounded-[16px] flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="service-num text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                01 / STEWARDSHIP & GIVING
              </span>
              <h3 className="text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                Zakat & Sadaqah
              </h3>
              <p className="text-xs text-[#1c2421]/75 leading-relaxed font-normal">
                Contribute directly to sovereign mosque operational funds, designated Zakat al-Mal accounts, and emergency community aid with instant cryptographic receipts.
              </p>
            </div>
            <Link href={`/mosque/${slug}/donations`} className="arrow-cta">
              DONATE TO MOSQUE
            </Link>
          </div>

          {/* Programmes Card */}
          <div className="service-card rounded-[16px] flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="service-num text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                02 / KNOWLEDGE & CIRCLES
              </span>
              <h3 className="text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                Learning Programmes
              </h3>
              <p className="text-xs text-[#1c2421]/75 leading-relaxed font-normal">
                Discover weekly Tafseer circles, youth leadership intensives, Sisters halaqahs, and Quranic recitation circles hosted at our facilities.
              </p>
            </div>
            <Link href={`/mosque/${slug}/programs`} className="arrow-cta">
              BROWSE TIMETABLE
            </Link>
          </div>
        </section>

        {/* Notices & Dispatches */}
        <section className="bg-white p-8 md:p-12 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-[#c89b3c]/20 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                COMMUNITY NOTICEBOARD
              </span>
              <h2 className="text-3xl font-black uppercase tracking-tight text-[#0d4734]">
                Latest Dispatches
              </h2>
            </div>
            <span className="text-[9px] font-mono text-[#1c2421]/50 uppercase">
              {announcements.length} Published Updates
            </span>
          </div>

          {announcements.length === 0 ? (
            <p className="text-xs font-mono uppercase text-[#1c2421]/50 py-6 text-center">
              No recent dispatches published.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {announcements.map((a) => (
                <article
                  key={a.announcement_id}
                  className="p-6 bg-[#f6f3eb] rounded-[12px] border border-[#c89b3c]/20 hover:border-[#0d4734] transition-all space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2 py-0.5 rounded">
                      {a.category}
                    </span>
                    <span className="text-[9px] font-mono text-[#1c2421]/50">
                      {new Date(a.posted_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-lg font-black uppercase tracking-tight text-[#0d4734]">
                    {a.title}
                  </h4>
                  <p className="text-xs text-[#1c2421]/70 leading-relaxed font-normal">
                    {a.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/50">
        &copy; 2026 MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
