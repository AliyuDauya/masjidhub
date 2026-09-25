'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  fallbackUrl?: string;
  className?: string;
  label?: string;
}

export default function BackButton({ fallbackUrl, className = '', label = 'BACK' }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (fallbackUrl) {
      router.push(fallbackUrl);
    } else {
      router.push('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      title="Return to previous page"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#c89b3c]/30 bg-white/80 hover:bg-[#e4efe9] text-[#0d4734] hover:text-[#0d4734] font-black text-[9px] uppercase tracking-widest transition-all shadow-xs hover:border-[#0d4734] cursor-pointer ${className}`}
    >
      <span className="text-xs leading-none">&larr;</span>
      <span>{label}</span>
    </button>
  );
}
