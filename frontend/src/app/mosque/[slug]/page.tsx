'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import NotificationCenter from '@/components/NotificationCenter';

interface Mosque {
  name: string;
  slug: string;
  status: string;
  address?: string;
  brand_color: string;
  timezone: string;
}

interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  category: string;
  posted_at: string;
}

export default function MosquePortal() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Mosque>(null, `/api/mosques/${slug}`)
      .then(setMosque)
      .catch((e) => setError(e.message));
    api<Announcement[]>(slug, '/api/announcements')
      .then(setAnnouncements)
      .catch((e) => setError(e.message));
  }, [slug]);

  const prayerTimes = [
    ['Fajr', '05:15'],
    ['Dhuhr', '13:00'],
    ['Asr', '16:30'],
    ['Maghrib', '19:12'],
    ['Isha', '20:45'],
  ];

  return (
    <div className="relative min-h-screen bg-[#f7f6f2] text-[#1c1c1c] overflow-x-hidden selection:bg-[#3d7068] selection:text-white">
      {/* 40px Background Grid */}
      <div className="editorial-grid-bg" aria-hidden="true" />

      {/* Guide lines */}
      <div className="guide-line guide-line-25 hidden md:block" aria-hidden="true" />
      <div className="guide-line guide-line-50 hidden md:block" aria-hidden="true" />
      <div className="guide-line guide-line-75 hidden md:block" aria-hidden="true" />

      {/* Header Band */}
      <header className="relative z-10 bg-white border-b-arch px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Link href="/" className="eyebrow-mono hover:underline">
                MASJIDHUB INDEX
              </Link>
              <span className="text-[#e5e4de]">/</span>
              <span className="mono text-[10px] uppercase tracking-[0.25em] text-[#666666]">
                {slug}
              </span>
            </div>
            <h1 className="serif text-3xl sm:text-4xl md:text-5xl uppercase font-light tracking-tight text-[#1c1c1c]">
              {mosque?.name || 'LOADING MOSQUE…'}
            </h1>
            <p className="text-xs sm:text-sm text-[#666666] mono uppercase tracking-[0.15em] mt-1">
              {mosque?.address || 'Address unlisted'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <NotificationCenter slug={slug} />
            <Link
              href={`/mosque/${slug}/login`}
              className="btn-editorial-secondary"
            >
              ADMIN SIGN IN
            </Link>
            <Link
              href={`/mosque/${slug}/register`}
              className="btn-editorial-cta"
            >
              JOIN MOSQUE
            </Link>
          </div>
        </div>
      </header>

      {/* Portal Main Grid */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Prayer Timetable */}
        <aside className="lg:col-span-4 space-y-8">
          <div className="card-editorial p-8 bg-white border-arch radius-arch shadow-xs">
            <div className="flex items-center justify-between border-b-arch pb-4 mb-6">
              <span className="eyebrow-mono">01 / DAILY IQAMAH</span>
              <span className="w-2 h-2 rounded-full bg-[#3d7068]" />
            </div>

            <h2 className="serif text-2xl uppercase font-light mb-6">Prayer Schedule</h2>

            <ul className="space-y-4 divide-y divide-[#e5e4de]">
              {prayerTimes.map(([name, time]) => (
                <li key={name} className="flex justify-between items-center pt-4">
                  <span className="mono text-xs uppercase tracking-[0.2em] font-bold text-[#1c1c1c]">
                    {name}
                  </span>
                  <time className="mono text-sm font-bold text-[#3d7068] tracking-widest bg-[#f7f6f2] px-3 py-1 border-arch radius-arch">
                    {time}
                  </time>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-6 border-t-arch flex justify-between items-center mono text-[9px] uppercase tracking-[0.2em] text-[#888888]">
              <span>TIMEZONE</span>
              <span>{mosque?.timezone || 'UTC'}</span>
            </div>
          </div>
        </aside>

        {/* Right Column: Giving, Programs & Announcements */}
        <section className="lg:col-span-8 space-y-10">
          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Link
              href={`/mosque/${slug}/donations`}
              className="card-editorial p-8 bg-white border-arch radius-arch block group"
            >
              <span className="eyebrow-mono mb-2 block">02 / DONATIONS</span>
              <h3 className="serif text-2xl uppercase font-light group-hover:text-[#3d7068] transition-colors mb-2">
                Digital Giving
              </h3>
              <p className="text-xs text-[#666666] leading-relaxed">
                Direct, transparent contributions with automated tax receipting.
              </p>
            </Link>

            <Link
              href={`/mosque/${slug}/programs`}
              className="card-editorial p-8 bg-white border-arch radius-arch block group"
            >
              <span className="eyebrow-mono mb-2 block">03 / PROGRAMMES</span>
              <h3 className="serif text-2xl uppercase font-light group-hover:text-[#3d7068] transition-colors mb-2">
                Education & Circles
              </h3>
              <p className="text-xs text-[#666666] leading-relaxed">
                Browse upcoming gatherings, reserve attendance, and stay informed.
              </p>
            </Link>
          </div>

          {/* Announcements Feed */}
          <div className="card-editorial p-8 md:p-10 bg-white border-arch radius-arch shadow-xs">
            <div className="flex items-center justify-between border-b-arch pb-4 mb-8">
              <span className="eyebrow-mono">04 / COMMUNITY NOTICEBOARD</span>
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-[#888888]">
                {announcements.length} NOTICES
              </span>
            </div>

            <h2 className="serif text-3xl uppercase font-light mb-8">Latest Dispatches</h2>

            {error && (
              <div className="p-4 border-arch border-red-300 bg-red-50 text-red-700 mono text-xs uppercase mb-6">
                {error}
              </div>
            )}

            {announcements.length === 0 ? (
              <div className="py-12 text-center border-arch bg-[#f7f6f2] radius-arch">
                <p className="mono text-xs uppercase tracking-[0.2em] text-[#666666]">
                  No public announcements currently active for this mosque.
                </p>
              </div>
            ) : (
              <div className="space-y-8 divide-y divide-[#e5e4de]">
                {announcements.map((a) => (
                  <article key={a.announcement_id} className="pt-8 first:pt-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="mono text-[9px] uppercase tracking-[0.25em] text-[#3d7068] font-bold px-2 py-0.5 bg-[#f7f6f2] border-arch">
                        {a.category}
                      </span>
                      <span className="mono text-[9px] uppercase tracking-[0.2em] text-[#888888]">
                        {new Date(a.posted_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="serif text-2xl uppercase font-light text-[#1c1c1c] mb-3">
                      {a.title}
                    </h3>
                    <p className="text-sm text-[#555555] leading-relaxed">
                      {a.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Portal Footer */}
      <footer className="relative z-10 py-12 border-t-arch bg-white text-center mono text-[10px] uppercase tracking-[0.25em] text-[#888888]">
        <div className="max-w-7xl mx-auto px-6">
          <span>{mosque?.name || 'MASJID'} · POWERED BY MASJIDHUB EDITORIAL ENGINE</span>
        </div>
      </footer>
    </div>
  );
}
