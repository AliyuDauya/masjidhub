'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface DonationMetrics {
  totalDonationsCount: number;
  totalDonated: number;
  byCategory: Record<string, number>;
  byMethod: Record<string, number>;
}

interface ProgramMetric {
  program_id: number;
  title: string;
  max_capacity: number;
  activeRegistrations: number;
  fillRate: number;
}

export default function AdminAnalytics() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';
  const [donations, setDonations] = useState<DonationMetrics | null>(null);
  const [programs, setPrograms] = useState<ProgramMetric[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<DonationMetrics>(slug, '/api/admin/analytics/donations'),
      api<ProgramMetric[]>(slug, '/api/admin/analytics/registrations'),
    ])
      .then(([d, p]) => {
        setDonations(d);
        setPrograms(p);
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Navigation Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
            ANALYTICS & METRICS (/{slug})
          </span>
        </div>

        <Link
          href={`/mosque/${slug}/admin`}
          className="btn-pill-secondary py-2 px-5 text-[9px] tracking-ultra-wide"
        >
          &larr; BACK TO WORKSPACE
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-16 flex-grow w-full space-y-12">
        <div className="border-b border-[#c89b3c]/20 pb-8">
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
            OPERATIONAL INTELLIGENCE
          </span>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter text-[#0d4734]">
            REPORTS & LEDGERS
          </h1>
          <p className="text-xs sm:text-sm text-[#1c2421]/70 mt-1 font-normal">
            Real-time reconciliation summaries, category distributions, and programme capacity saturation.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
            {error}
          </div>
        )}

        {!donations ? (
          <div className="p-12 text-center text-xs font-bold uppercase tracking-wider text-[#1c2421]/50 bg-white rounded-[16px] border border-[#c89b3c]/20">
            Compiling ledger reports…
          </div>
        ) : (
          <div className="space-y-10">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
                  01 / COMPLETED GIVING
                </span>
                <p className="text-3xl font-black tracking-tight text-[#0d4734]">
                  ₦{donations.totalDonated.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">
                  Reconciled & unallocated total
                </p>
              </div>

              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
                  02 / RECEIPTS ISSUED
                </span>
                <p className="text-3xl font-black tracking-tight text-[#0d4734]">
                  {donations.totalDonationsCount}
                </p>
                <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">
                  Cryptographically signed transactions
                </p>
              </div>

              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
                  03 / ACTIVE PROGRAMMES
                </span>
                <p className="text-3xl font-black tracking-tight text-[#0d4734]">
                  {programs.length}
                </p>
                <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">
                  Classes, halaqahs & circles
                </p>
              </div>
            </div>

            {/* Breakdown Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Giving by Category */}
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-sm space-y-6">
                <div className="border-b border-[#c89b3c]/15 pb-4">
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    ALLOCATION RATIOS
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                    Giving by Category
                  </h2>
                </div>

                <div className="space-y-5">
                  {Object.entries(donations.byCategory).map(([name, value]) => {
                    const pct = donations.totalDonated ? Math.round((value / donations.totalDonated) * 100) : 0;
                    return (
                      <div key={name} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-black uppercase tracking-wider text-[#1c2421]">
                          <span>{name} ({pct}%)</span>
                          <span className="font-mono text-[#0d4734]">₦{value.toLocaleString()}</span>
                        </div>
                        <div className="h-2.5 bg-[#f6f3eb] rounded-full overflow-hidden border border-[#c89b3c]/20">
                          <div
                            className="h-full bg-[#0d4734] rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Programme Capacity Saturation */}
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-sm space-y-6">
                <div className="border-b border-[#c89b3c]/15 pb-4">
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    SEAT FILL RATES
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                    Programme Attendance
                  </h2>
                </div>

                {programs.length === 0 ? (
                  <p className="text-xs font-mono text-[#1c2421]/50 uppercase py-6">
                    No active programmes recorded.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {programs.map((p) => {
                      const fillPct = Math.min(100, Math.round(p.fillRate || 0));
                      return (
                        <div key={p.program_id} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-black uppercase tracking-wider text-[#1c2421]">
                            <span>{p.title}</span>
                            <span className="font-mono text-[#0d4734]">
                              {p.activeRegistrations} / {p.max_capacity || '∞'} ({fillPct}%)
                            </span>
                          </div>
                          <div className="h-2.5 bg-[#f6f3eb] rounded-full overflow-hidden border border-[#c89b3c]/20">
                            <div
                              className="h-full bg-[#c89b3c] rounded-full transition-all duration-700"
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
