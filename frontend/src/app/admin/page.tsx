'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface UserMe {
  user_id: number;
  name: string;
  email: string;
  platform_role?: string;
  memberships: Array<{
    role: string;
    status: string;
    mosque: { slug: string; name: string };
  }>;
}

export default function AdminPortalRedirect() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState('Resolving Mosque Admin Workspace…');

  useEffect(() => {
    async function resolveAdminDestination() {
      try {
        let candidateSlug = 'al-noor';
        if (typeof window !== 'undefined') {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('masjidhub:') && key.endsWith(':token') && !key.includes('platform')) {
              const parts = key.split(':');
              if (parts[1]) {
                candidateSlug = parts[1];
                break;
              }
            }
          }
        }

        const me = await api<UserMe>(candidateSlug, '/api/auth/me');
        if (me && me.memberships && me.memberships.length > 0) {
          const adminMembership = me.memberships.find(
            (m) =>
              m.status === 'Active' &&
              ['tenant_admin', 'programme_officer', 'communications_officer', 'finance_officer'].includes(m.role)
          );

          if (adminMembership && adminMembership.mosque?.slug) {
            setStatusMessage(`Opening Admin Workspace for ${adminMembership.mosque.name}…`);
            router.replace(`/mosque/${adminMembership.mosque.slug}/admin`);
            return;
          }

          const firstActive = me.memberships.find((m) => m.status === 'Active');
          if (firstActive && firstActive.mosque?.slug) {
            router.replace(`/mosque/${firstActive.mosque.slug}/dashboard`);
            return;
          }
        }

        router.replace('/login');
      } catch {
        router.replace('/login');
      }
    }

    resolveAdminDestination();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fcfbfa] flex items-center justify-center p-8 text-center font-sans">
      <div className="space-y-4">
        <div className="w-10 h-10 border-4 border-[#0d4734] border-t-[#c89b3c] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-black uppercase tracking-widest text-[#0d4734]">
          {statusMessage}
        </p>
      </div>
    </div>
  );
}
