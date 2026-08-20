'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Program {
  program_id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  max_capacity: number;
}

export default function MosquePrograms() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';
  const [programs, setPrograms] = useState<Program[]>([]);
  const [registered, setRegistered] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mosqueName = slug
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

  useEffect(() => {
    api<Program[]>(slug, '/api/programs')
      .then(setPrograms)
      .catch((e) => setError(e.message));
    api<Array<{ program_id: number; status: string }>>(slug, '/api/members/registrations')
      .then((rows) => setRegistered(rows.filter((r) => r.status === 'Registered').map((r) => r.program_id)))
      .catch(() => undefined);
  }, [slug]);

  async function reserve(id: number) {
    setError('');
    setSuccess('');
    try {
      await api(slug, `/api/programs/${id}/register`, { method: 'POST' });
      setRegistered([...registered, id]);
      setSuccess('Seat successfully reserved. We look forward to welcoming you.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seat could not be reserved.');
    }
  }

  async function cancel(id: number) {
    setError('');
    setSuccess('');
    try {
      await api(slug, `/api/programs/${id}/cancel`, { method: 'POST' });
      setRegistered(registered.filter((x) => x !== id));
      setSuccess('Registration cancelled.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration could not be cancelled.');
    }
  }

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between">
        <Link href={`/mosque/${slug}`} className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
          <span>MASJIDHUB</span>
        </Link>
        <Link href={`/mosque/${slug}`} className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors">
          &larr; BACK TO MOSQUE
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-16 flex-grow w-full space-y-12">
        <div>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
            02 / EDUCATIONAL CIRCLES & EVENTS
          </span>
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter text-[#0d4734]">
            {mosqueName} <span className="italic font-light lowercase text-[#c89b3c]">programmes</span>
          </h1>
          <p className="text-sm md:text-base text-[#1c2421]/70 max-w-2xl mt-2 font-normal">
            Structured classes, community lectures, and halaqahs hosted under sovereign sanctuary spaces.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-[#e4efe9] border border-[#0d4734] text-[#0d4734] text-xs font-bold uppercase rounded-[6px]">
            {success}
          </div>
        )}

        {programs.length === 0 ? (
          <div className="bg-white p-12 rounded-[16px] border-2 border-[#c89b3c]/20 text-center space-y-2">
            <h2 className="text-2xl font-black uppercase text-[#0d4734]">No programmes currently scheduled</h2>
            <p className="text-xs text-[#1c2421]/60 font-normal">
              New Islamic classes, seminars, and halaqahs will appear here once published by the mosque leadership.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {programs.map((program) => {
              const starts = new Date(program.start_date);
              const isRegistered = registered.includes(program.program_id);
              return (
                <article
                  key={program.program_id}
                  className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-sm hover:border-[#0d4734] transition-all flex flex-col justify-between min-h-[300px] group"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#c89b3c]/15 pb-4 mb-4">
                      <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                        {starts.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {starts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2.5 py-1 rounded-full">
                        {program.max_capacity ? `${program.max_capacity} SEATS MAX` : 'OPEN SEATING'}
                      </span>
                    </div>

                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734] mb-3 group-hover:text-[#c89b3c] transition-colors">
                      {program.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#1c2421]/70 leading-relaxed font-normal mb-4">
                      {program.description}
                    </p>
                  </div>

                  <div className="pt-6 border-t border-[#c89b3c]/15 flex items-center justify-between gap-4">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1c2421]/60">
                      📍 {program.location}
                    </span>
                    {isRegistered ? (
                      <button
                        onClick={() => cancel(program.program_id)}
                        className="btn-pill-secondary py-2.5 px-6 text-[9px] tracking-ultra-wide"
                      >
                        CANCEL SEAT
                      </button>
                    ) : (
                      <button
                        onClick={() => reserve(program.program_id)}
                        className="btn-pill-cta py-2.5 px-6 text-[9px] tracking-ultra-wide"
                      >
                        RESERVE SEAT →
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
