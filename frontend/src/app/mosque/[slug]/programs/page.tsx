'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Program { program_id: number; title: string; description: string; start_date: string; end_date: string; location: string; max_capacity: number; }

export default function MosquePrograms() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';
  const [programs, setPrograms] = useState<Program[]>([]);
  const [registered, setRegistered] = useState<number[]>([]);
  const [error, setError] = useState('');
  const mosqueName = slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

  useEffect(() => {
    api<Program[]>(slug, '/api/programs').then(setPrograms).catch(e => setError(e.message));
    api<Array<{ program_id: number; status: string }>>(slug, '/api/members/registrations')
      .then(rows => setRegistered(rows.filter(r => r.status === 'Registered').map(r => r.program_id))).catch(() => undefined);
  }, [slug]);

  async function reserve(id: number) {
    setError('');
    try { await api(slug, `/api/programs/${id}/register`, { method: 'POST' }); setRegistered([...registered, id]); }
    catch (e) { setError(e instanceof Error ? e.message : 'Seat could not be reserved.'); }
  }
  async function cancel(id: number) {
    setError('');
    try { await api(slug, `/api/programs/${id}/cancel`, { method: 'POST' }); setRegistered(registered.filter(x => x !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Registration could not be cancelled.'); }
  }

  return <main className="min-h-screen">
    <header className="tenant-band px-6 py-5 flex items-center justify-between">
      <div><p className="eyebrow">{mosqueName}</p><h1 className="text-2xl font-bold">Learning & community programmes</h1></div>
      <Link href={`/mosque/${slug}`} className="btn-secondary text-sm">Back to mosque</Link>
    </header>
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="max-w-2xl mb-10"><h2 className="text-4xl font-bold">Reserve your place</h2><p className="mt-3 text-slate-600">Classes, lectures, and circles organised by your mosque. Sign in before reserving a seat.</p></div>
      {error && <p className="mb-6 p-4 rounded-lg bg-red-50 text-red-700">{error}</p>}
      {programs.length === 0 ? <div className="card-premium"><h3>No programmes published</h3><p className="text-slate-500 mt-2">Published programmes will appear here.</p></div> :
      <div className="grid md:grid-cols-2 gap-6">{programs.map(program => {
        const starts = new Date(program.start_date); const isRegistered = registered.includes(program.program_id);
        return <article key={program.program_id} className="card-premium flex flex-col justify-between">
          <div><p className="eyebrow">{starts.toLocaleDateString()} · {starts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p><h3 className="text-2xl font-bold mt-3">{program.title}</h3><p className="text-slate-600 mt-3">{program.description}</p></div>
          <div className="mt-8 pt-4 border-t flex items-center justify-between"><span className="text-sm text-slate-500">{program.location} · {program.max_capacity ? `${program.max_capacity} seats` : 'Open capacity'}</span>
          {isRegistered ? <button onClick={() => cancel(program.program_id)} className="btn-secondary text-sm">Cancel seat</button> : <button onClick={() => reserve(program.program_id)} className="btn-primary text-sm">Reserve seat</button>}</div>
        </article>;
      })}</div>}
    </section>
  </main>;
}
