'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPortalRedirect() {
  const router = useRouter();

  useEffect(() => {
    let defaultSlug = 'al-noor';
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('masjidhub:') && key.endsWith(':token') && !key.includes('platform')) {
          const parts = key.split(':');
          if (parts[1]) {
            defaultSlug = parts[1];
            break;
          }
        }
      }
    }
    router.replace(`/mosque/${defaultSlug}/admin`);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fcfbfa] flex items-center justify-center p-8 text-center font-sans">
      <div className="space-y-4">
        <div className="w-10 h-10 border-4 border-[#0d4734] border-t-[#c89b3c] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-black uppercase tracking-widest text-[#0d4734]">
          Opening Mosque Admin Workspace…
        </p>
      </div>
    </div>
  );
}
