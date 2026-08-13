'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Mosque { name: string; slug: string; status: string; address?: string; brand_color: string; timezone: string }
interface Announcement { announcement_id: number; title: string; content: string; category: string; posted_at: string }

export default function MosquePortal() {
  const params = useParams(); const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';
  const [mosque, setMosque] = useState<Mosque | null>(null); const [announcements, setAnnouncements] = useState<Announcement[]>([]); const [error, setError] = useState('');
  useEffect(() => { api<Mosque>(null, `/api/mosques/${slug}`).then(setMosque).catch(e => setError(e.message)); api<Announcement[]>(slug, '/api/announcements').then(setAnnouncements).catch(e => setError(e.message)); }, [slug]);
  const prayerTimes = [['Fajr','05:15'],['Dhuhr','13:00'],['Asr','16:30'],['Maghrib','19:12'],['Isha','20:45']];

  return <main className="min-h-screen" style={{ '--tenant-color': mosque?.brand_color || '#087f5b' } as React.CSSProperties}>
    <header className="tenant-band px-6 py-5 flex flex-wrap gap-4 justify-between items-center">
      <div><Link href="/" className="eyebrow">MasjidHub / {slug}</Link><h1 className="text-3xl font-bold mt-1">{mosque?.name || 'Loading mosque…'}</h1><p className="text-sm text-slate-500">{mosque?.address}</p></div>
      <div className="flex gap-3"><Link href={`/mosque/${slug}/login`} className="btn-secondary text-sm">Sign in</Link><Link href={`/mosque/${slug}/register`} className="btn-primary text-sm">Join mosque</Link></div>
    </header>
    <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8">
      <aside className="card-premium"><p className="eyebrow">Today’s iqamah</p><ul className="mt-5 space-y-3">{prayerTimes.map(([name,time]) => <li key={name} className="flex justify-between py-2 border-b"><strong>{name}</strong><time className="font-mono text-emerald-700">{time}</time></li>)}</ul><p className="text-xs text-slate-400 mt-4">Local mosque timetable · {mosque?.timezone}</p></aside>
      <section className="md:col-span-2 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4"><Link href={`/mosque/${slug}/donations`} className="card-premium block"><p className="eyebrow">Giving</p><h2 className="text-2xl font-bold mt-3">Support the work</h2><p className="text-slate-500 mt-2">Receive a traceable digital receipt.</p></Link><Link href={`/mosque/${slug}/programs`} className="card-premium block"><p className="eyebrow">Programmes</p><h2 className="text-2xl font-bold mt-3">Learn together</h2><p className="text-slate-500 mt-2">Browse sessions and reserve a seat.</p></Link></div>
        <div className="card-premium"><p className="eyebrow">Community noticeboard</p><h2 className="text-3xl font-bold mt-3 mb-6">Latest announcements</h2>{error && <p className="text-red-600">{error}</p>}{announcements.length === 0 ? <p className="text-slate-500">There are no public announcements right now.</p> : <div className="space-y-6">{announcements.map(a => <article key={a.announcement_id} className="border-b pb-5"><p className="text-xs font-bold text-emerald-700">{a.category} · {new Date(a.posted_at).toLocaleDateString()}</p><h3 className="text-xl font-bold mt-2">{a.title}</h3><p className="text-slate-600 mt-2">{a.content}</p></article>)}</div>}</div>
      </section>
    </div>
  </main>;
}
