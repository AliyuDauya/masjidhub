'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function MosquePortal() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  // Capitalize name for visual aesthetics
  const mosqueName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ' Portal';

  // Static placeholders for Sprint 1 demonstration
  const mockPrayerTimes = [
    { name: 'Fajr', time: '05:15 AM' },
    { name: 'Dhuhr', time: '01:00 PM' },
    { name: 'Asr', time: '04:30 PM' },
    { name: 'Maghrib', time: '07:12 PM' },
    { name: 'Isha', time: '08:45 PM' },
  ];

  const mockAnnouncements = [
    {
      id: 1,
      title: 'Summer Quran Program Registration Open',
      content: 'Classes start next month. Register under the programs tab or visit the administrative desk.',
      category: 'Event',
      date: 'July 16, 2026'
    },
    {
      id: 2,
      title: 'Friday Khutbah Time Adjustment',
      content: 'The first Jumuah sermon will commence at 1:15 PM instead of 1:30 PM starting this Friday.',
      category: 'Urgent',
      date: 'July 15, 2026'
    }
  ];

  return (
    <main className="min-h-screen flex flex-col justify-between">
      {/* Dynamic Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6 flex justify-between items-center shadow-sm">
        <Link href="/" className="text-xl font-extrabold text-emerald-600 dark:text-emerald-500">
          MasjidHub
        </Link>
        <div className="flex gap-4">
          <Link href={`/mosque/${slug}/login`} className="btn-secondary px-4 py-2 text-sm">
            Sign In
          </Link>
          <Link href={`/mosque/${slug}/register`} className="btn-primary px-4 py-2 text-sm">
            Register
          </Link>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="max-w-6xl mx-auto px-6 py-12 flex-grow w-full grid md:grid-cols-3 gap-8">
        
        {/* Left Column: Mosque Info & Prayer Times */}
        <section className="space-y-6 md:col-span-1">
          <div className="card-premium">
            <h2 className="text-2xl font-bold mb-1 text-slate-800 dark:text-white">{mosqueName}</h2>
            <p className="text-sm text-slate-500 mb-6">Local Time: {new Date().toLocaleDateString()}</p>
            
            <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 text-emerald-600 dark:text-emerald-500">
              Prayer Times (Iqamah)
            </h3>
            <ul className="space-y-3">
              {mockPrayerTimes.map((prayer) => (
                <li key={prayer.name} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{prayer.name}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded">
                    {prayer.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right Column: Dashboard Feed & Operations */}
        <section className="space-y-6 md:col-span-2">
          
          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card-premium text-center hover:scale-102 cursor-pointer flex flex-col justify-between py-6">
              <h4 className="font-bold text-lg text-slate-800 dark:text-white">Make Donation</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">Support Zakat, Sadaqah, or local mosque operations.</p>
              <span className="btn-primary text-xs w-fit mx-auto">Donate Now</span>
            </div>
            <div className="card-premium text-center hover:scale-102 cursor-pointer flex flex-col justify-between py-6">
              <h4 className="font-bold text-lg text-slate-800 dark:text-white">View Calendar</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">Browse upcoming lectures, Quran study sessions, and register.</p>
              <span className="btn-secondary text-xs w-fit mx-auto">Browse Programs</span>
            </div>
          </div>

          {/* Announcements Feed */}
          <div className="card-premium">
            <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Announcements</h3>
            <div className="space-y-6">
              {mockAnnouncements.map((ann) => (
                <div key={ann.id} className="border-b border-slate-100 dark:border-slate-800 pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      ann.category === 'Urgent' 
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' 
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    }`}>
                      {ann.category}
                    </span>
                    <span className="text-xs text-slate-400">{ann.date}</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{ann.title}</h4>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} {mosqueName}. Powered by MasjidHub.</p>
      </footer>
    </main>
  );
}
