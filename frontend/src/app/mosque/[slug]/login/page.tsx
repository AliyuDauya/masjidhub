'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RoleBasedLoginForm, { MosqueOption } from '@/components/auth/RoleBasedLoginForm';
import { api } from '@/lib/api';
import BackButton from '@/components/BackButton';

export default function MosqueLoginPage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';
  const [currentMosqueName, setCurrentMosqueName] = useState('');

  useEffect(() => {
    api<MosqueOption[]>(null, '/api/mosques')
      .then((data) => {
        if (data && Array.isArray(data)) {
          const found = data.find((m) => m.slug === slug);
          if (found) setCurrentMosqueName(found.name);
        }
      })
      .catch(() => {});
  }, [slug]);

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl={`/mosque/${slug}`} />
          <Link
            href={`/mosque/${slug}`}
            className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3"
          >
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40 hidden sm:inline">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] hidden sm:inline">
            PORTAL AUTHENTICATION
          </span>
        </div>
        <Link
          href={`/mosque/${slug}`}
          className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors"
        >
          MOSQUE PORTAL &rarr;
        </Link>
      </header>

      {/* Main Login Workspace */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-grow w-full flex items-center justify-center">
        <RoleBasedLoginForm
          initialRole="member"
          defaultSlug={slug}
          isMosquePortal={true}
          currentMosqueName={currentMosqueName}
        />
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
