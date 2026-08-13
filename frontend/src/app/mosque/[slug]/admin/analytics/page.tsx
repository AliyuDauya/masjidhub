'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface DonationMetrics { totalDonationsCount: number; totalDonated: number; byCategory: Record<string,number>; byMethod: Record<string,number> }
interface ProgramMetric { program_id: number; title: string; max_capacity: number; activeRegistrations: number; fillRate: number }

export default function AdminAnalytics() {
  const params = useParams(); const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';
  const [donations, setDonations] = useState<DonationMetrics | null>(null); const [programs, setPrograms] = useState<ProgramMetric[]>([]); const [error, setError] = useState('');
  useEffect(() => { Promise.all([api<DonationMetrics>(slug, '/api/admin/analytics/donations'), api<ProgramMetric[]>(slug, '/api/admin/analytics/registrations')]).then(([d,p]) => { setDonations(d); setPrograms(p); }).catch(e => setError(e.message)); }, [slug]);
  return <main className="min-h-screen"><header className="tenant-band px-6 py-5 flex justify-between"><div><p className="eyebrow">Reports / {slug}</p><h1 className="text-3xl font-bold">Operational picture</h1></div><Link href={`/mosque/${slug}/admin`} className="btn-secondary text-sm">Back to workspace</Link></header>
  <section className="max-w-6xl mx-auto px-6 py-12">{error && <p className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</p>}{!donations ? <p>Loading reports…</p> : <><div className="grid sm:grid-cols-3 gap-5"><Metric label="Completed giving" value={`NGN ${donations.totalDonated.toLocaleString()}`}/><Metric label="Receipts issued" value={String(donations.totalDonationsCount)}/><Metric label="Published programmes" value={String(programs.length)}/></div><div className="grid md:grid-cols-2 gap-6 mt-8"><div className="card-premium"><h2 className="text-2xl font-bold mb-6">Giving by purpose</h2>{Object.entries(donations.byCategory).map(([name,value]) => <Bar key={name} name={name} value={value} max={donations.totalDonated}/>)}</div><div className="card-premium"><h2 className="text-2xl font-bold mb-6">Programme capacity</h2>{programs.map(p => <Bar key={p.program_id} name={`${p.title} · ${p.activeRegistrations}/${p.max_capacity || 'open'}`} value={p.fillRate} max={100}/>)}</div></div></>}</section></main>;
}
function Metric({label,value}:{label:string;value:string}) { return <div className="card-premium"><p className="eyebrow">{label}</p><strong className="text-3xl block mt-3">{value}</strong></div>; }
function Bar({name,value,max}:{name:string;value:number;max:number}) { const pct = max ? Math.min(100,value/max*100) : 0; return <div className="mb-5"><div className="flex justify-between text-sm mb-2"><span>{name}</span><strong>{value.toLocaleString()}</strong></div><div className="h-2 bg-slate-100 rounded"><div className="h-full bg-emerald-600 rounded" style={{width:`${pct}%`}}/></div></div>; }
