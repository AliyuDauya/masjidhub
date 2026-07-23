'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function AdminAnalytics() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  // State mock metrics matching backend calculations
  const [totalCount, setTotalCount] = useState(25);
  const [totalDonated, setTotalDonated] = useState(4850.00);
  const [byCategory, setByCategory] = useState({
    Zakat: 2500,
    Sadaqah: 1350,
    Waqf: 700,
    General: 300
  });

  const [programsMetrics, setProgramsMetrics] = useState([
    { id: 1, title: 'Summer Tajweed Intensive', registered: 28, capacity: 30, fillRate: 93.3 },
    { id: 2, title: 'Islamic Finance & Zakat Seminar', registered: 45, capacity: 100, fillRate: 45.0 },
    { id: 3, title: 'Youth Weekly Circle', registered: 15, capacity: 0, fillRate: 100 }
  ]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-between">
      {/* Navbar */}
      <header className="masjid-gradient-bg text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Admin Analytics Dashboard</h1>
          <p className="text-xs text-emerald-200">Mosque: /mosque/{slug}</p>
        </div>
        <Link href={`/mosque/${slug}/admin`} className="btn-secondary text-xs border-emerald-400 text-emerald-100 hover:bg-emerald-800">
          ← Back to Admin Console
        </Link>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-8 flex-grow w-full space-y-8 animate-fade-in">
        
        {/* Metric Cards Grid */}
        <section className="grid sm:grid-cols-3 gap-6">
          <div className="card-premium text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Donations</span>
            <span className="text-4xl font-extrabold text-slate-800 dark:text-white block mt-2">${totalDonated.toLocaleString()}</span>
            <span className="text-xs text-emerald-500 font-bold mt-1 block">Completed Transactions</span>
          </div>
          <div className="card-premium text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Transactions Count</span>
            <span className="text-4xl font-extrabold text-slate-800 dark:text-white block mt-2">{totalCount}</span>
            <span className="text-xs text-slate-500 mt-1 block">Online & Offline Cash Logs</span>
          </div>
          <div className="card-premium text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active Programs</span>
            <span className="text-4xl font-extrabold text-slate-800 dark:text-white block mt-2">{programsMetrics.length}</span>
            <span className="text-xs text-slate-500 mt-1 block">Scheduled Religious Activities</span>
          </div>
        </section>

        {/* Charts & breakdowns split grid */}
        <section className="grid md:grid-cols-2 gap-8">
          
          {/* Donations Category Allocations Breakdown */}
          <div className="card-premium">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 pb-2 border-b border-slate-100 dark:border-slate-800">
              Category Distribution
            </h3>
            <div className="space-y-4">
              {Object.entries(byCategory).map(([cat, amt]) => {
                const pct = ((amt / totalDonated) * 100).toFixed(1);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{cat}</span>
                      <span className="font-bold text-slate-800 dark:text-white">${amt.toLocaleString()} ({pct}%)</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Program Capacity Registrations Breakdown */}
          <div className="card-premium">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 pb-2 border-b border-slate-100 dark:border-slate-800">
              Program Attendance & Capacity
            </h3>
            <div className="space-y-4">
              {programsMetrics.map((prog) => (
                <div key={prog.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-xs">{prog.title}</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {prog.registered}/{prog.capacity > 0 ? prog.capacity : '∞'} seats ({prog.fillRate}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(prog.fillRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} MasjidHub Admin Analytics.</p>
      </footer>
    </main>
  );
}
