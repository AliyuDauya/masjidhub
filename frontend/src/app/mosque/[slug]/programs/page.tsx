'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Program {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  registeredCount: number;
}

export default function MosquePrograms() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  // Capitalize name for visual aesthetics
  const mosqueName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ' Programs';

  const [programs, setPrograms] = useState<Program[]>([
    {
      id: 1,
      title: 'Summer Tajweed Intensive',
      description: 'A 4-week program covering pronunciation and rules of recitation.',
      date: '2026-07-25',
      time: '05:00 PM',
      location: 'Hall A',
      capacity: 30,
      registeredCount: 28
    },
    {
      id: 2,
      title: 'Islamic Finance & Zakat Seminar',
      description: 'Understanding Zakat calculation methods and modern financial transactions.',
      date: '2026-08-01',
      time: '10:00 AM',
      location: 'Main Auditorium',
      capacity: 100,
      registeredCount: 45
    },
    {
      id: 3,
      title: 'Youth Weekly Circle',
      description: 'Discussion circle and activities for youth aged 14-21.',
      date: '2026-07-29',
      time: '06:30 PM',
      location: 'Youth Center Room',
      capacity: 0, // Unlimited
      registeredCount: 15
    }
  ]);

  const [userRegistrations, setUserRegistrations] = useState<number[]>([3]); // User pre-registered to Youth Circle

  const handleRegister = (id: number) => {
    if (userRegistrations.includes(id)) return;

    // Check capacity
    const target = programs.find(p => p.id === id);
    if (target && target.capacity > 0 && target.registeredCount >= target.capacity) {
      alert('Failed: Capacity is full.');
      return;
    }

    setUserRegistrations([...userRegistrations, id]);
    setPrograms(programs.map(p => {
      if (p.id === id) {
        return { ...p, registeredCount: p.registeredCount + 1 };
      }
      return p;
    }));
  };

  const handleCancel = (id: number) => {
    setUserRegistrations(userRegistrations.filter(regId => regId !== id));
    setPrograms(programs.map(p => {
      if (p.id === id) {
        return { ...p, registeredCount: p.registeredCount - 1 };
      }
      return p;
    }));
  };

  return (
    <main className="min-h-screen flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6 flex justify-between items-center shadow-sm">
        <Link href={`/mosque/${slug}`} className="text-xl font-extrabold text-emerald-600 dark:text-emerald-500">
          MasjidHub
        </Link>
        <Link href={`/mosque/${slug}`} className="btn-secondary px-4 py-2 text-sm">
          ← Back to Portal
        </Link>
      </header>

      {/* Program Grid */}
      <div className="max-w-5xl mx-auto px-6 py-12 flex-grow w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white">{mosqueName}</h2>
          <p className="text-slate-500 mt-2">Browse and register for upcoming programs, classes, and social circles.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {programs.map((prog) => {
            const isRegistered = userRegistrations.includes(prog.id);
            const isFull = prog.capacity > 0 && prog.registeredCount >= prog.capacity;

            return (
              <div key={prog.id} className="card-premium flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded">
                      📅 {prog.date} | ⏰ {prog.time}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      📍 {prog.location}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{prog.title}</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                    {prog.description}
                  </p>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between items-center">
                  <div className="text-xs text-slate-500">
                    {prog.capacity > 0 ? (
                      <span>
                        Capacity:{' '}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {prog.registeredCount}/{prog.capacity}
                        </strong>{' '}
                        {isFull && <span className="text-red-500 font-bold ml-1">(FULL)</span>}
                      </span>
                    ) : (
                      <span className="text-emerald-500 font-semibold">Unlimited Seats</span>
                    )}
                  </div>

                  {isRegistered ? (
                    <button
                      onClick={() => handleCancel(prog.id)}
                      className="px-4 py-2 text-xs font-semibold text-red-500 border border-red-200 hover:border-red-400 rounded-lg transition-all"
                    >
                      Cancel Seat
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRegister(prog.id)}
                      disabled={isFull}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                        isFull
                          ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                          : 'btn-primary'
                      }`}
                    >
                      Register Seat
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} {mosqueName}. Powered by MasjidHub.</p>
      </footer>
    </main>
  );
}
