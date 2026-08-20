'use client';

import React from 'react';
import Link from 'next/link';
import RoleBasedLoginForm from '@/components/auth/RoleBasedLoginForm';

export default function GlobalLoginPage() {
  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40 hidden sm:inline">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] hidden sm:inline">
            GLOBAL AUTHENTICATION
          </span>
        </div>
        <Link
          href="/"
          className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors"
        >
          &larr; HOME
        </Link>
      </header>

      {/* Main Login Workspace */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-grow w-full flex items-center justify-center">
        <RoleBasedLoginForm
          initialRole="member"
          defaultSlug="al-noor"
          isMosquePortal={false}
        />
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
