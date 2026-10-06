'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export type PortalRole = 'member' | 'admin' | 'operator';

export interface MosqueOption {
  mosque_id: number;
  name: string;
  slug: string;
  address?: string;
  brand_color?: string;
  status?: string;
}

export interface RoleBasedLoginFormProps {
  initialRole?: PortalRole;
  defaultSlug?: string;
  isMosquePortal?: boolean;
  currentMosqueName?: string;
}

interface RoleConfig {
  id: PortalRole;
  label: string;
  badge: string;
  tagline: string;
  title: string;
  description: string;
  endpoint: string;
  requiresSlug: boolean;
  destination: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  buttonText: string;
  buttonLoading: string;
  features: Array<{ icon: string; title: string; desc: string }>;
}

export const ROLE_CONFIGS: Record<PortalRole, RoleConfig> = {
  member: {
    id: 'member',
    label: 'Worshipper / Member',
    badge: 'WORSHIPPER & MEMBER ACCESS',
    tagline: 'Congregation Member Portal',
    title: 'Member Sign-In',
    description:
      'Access your personal dashboard, active class & programme passes, donation history, and charitable tax receipts.',
    endpoint: '/api/auth/login',
    requiresSlug: true,
    destination: '/mosque/[slug]/dashboard',
    emailLabel: 'Worshipper Email Address *',
    emailPlaceholder: 'worshipper@example.com',
    passwordPlaceholder: '••••••••',
    buttonText: 'SIGN IN AS MEMBER →',
    buttonLoading: 'SIGNING IN AS MEMBER…',
    features: [
      {
        icon: '✦',
        title: 'Giving Ledger & Tax Receipts',
        desc: 'Instant cryptographic receipts for Zakat and Sadaqah'
      },
      {
        icon: '✦',
        title: 'Class & Programme Passes',
        desc: 'Booked halaqahs, tajweed seats and registration passes'
      },
      {
        icon: '✦',
        title: 'Multi-Mosque Hub Pass',
        desc: 'Switch between joined mosques instantly with 1-click'
      }
    ]
  },
  admin: {
    id: 'admin',
    label: 'Mosque Admin & Imam',
    badge: 'MOSQUE ADMINISTRATOR & IMAM',
    tagline: 'Masjid Administration Workspace',
    title: 'Admin & Imam Sign-In',
    description:
      'Manage Iqamah prayer schedules, publish community announcements, register cash donations, and supervise check-ins.',
    endpoint: '/api/auth/login',
    requiresSlug: true,
    destination: '/mosque/[slug]/admin',
    emailLabel: 'Administrator / Imam Email *',
    emailPlaceholder: 'admin@masjid.org',
    passwordPlaceholder: '••••••••',
    buttonText: 'SIGN IN TO ADMIN CONSOLE →',
    buttonLoading: 'OPENING WORKSPACE…',
    features: [
      {
        icon: '✦',
        title: 'Iqamah & Timetable Control',
        desc: 'Real-time schedule synchronization and display feeds'
      },
      {
        icon: '✦',
        title: 'Treasury & Cash Reconciliation',
        desc: 'Record cash donations, categorize funds and export CSVs'
      },
      {
        icon: '✦',
        title: 'Attendance & Announcements',
        desc: 'Broadcast updates, supervise door lists and seat limits'
      }
    ]
  },
  operator: {
    id: 'operator',
    label: 'Platform Operator',
    badge: 'SOVEREIGN PLATFORM OPERATOR',
    tagline: 'Sovereign Super-Admin Console',
    title: 'Platform Operator Sign-In',
    description:
      'Dedicated access portal for platform super-administrators overseeing multi-tenant mosque onboarding, tenant status, and metrics.',
    endpoint: '/api/platform/auth/login',
    requiresSlug: false,
    destination: '/platform',
    emailLabel: 'Operator Email Address *',
    emailPlaceholder: 'operator@masjidhub.org',
    passwordPlaceholder: '••••••••••••',
    buttonText: 'AUTHENTICATE PLATFORM OPERATOR →',
    buttonLoading: 'VERIFYING CREDENTIALS…',
    features: [
      {
        icon: '✦',
        title: 'Multi-Tenant Governance',
        desc: 'Review legal applications, activate or suspend tenants'
      },
      {
        icon: '✦',
        title: 'Platform-Wide Telemetry',
        desc: 'Track cross-tenant congregants, donations and programs'
      },
      {
        icon: '✦',
        title: 'Sovereign Security & Audit',
        desc: 'Supervise HMAC CSRF integrity and immutable audit trails'
      }
    ]
  }
};

const DEFAULT_MOSQUES: MosqueOption[] = [
  { mosque_id: 1, name: 'Al-Noor Central Masjid', slug: 'al-noor', status: 'Active' },
  { mosque_id: 2, name: 'Masjid Al-Huda', slug: 'al-huda', status: 'Active' },
  { mosque_id: 3, name: 'Al-Iman Islamic Center', slug: 'al-iman', status: 'Active' }
];

export default function RoleBasedLoginForm({
  initialRole = 'member',
  defaultSlug = 'al-noor',
  isMosquePortal = false,
  currentMosqueName
}: RoleBasedLoginFormProps) {
  const router = useRouter();

  const [activeRole, setActiveRole] = useState<PortalRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedMosqueSlug, setSelectedMosqueSlug] = useState(defaultSlug);
  const [allMosques, setAllMosques] = useState<MosqueOption[]>(DEFAULT_MOSQUES);
  const [resolvedMosqueName, setResolvedMosqueName] = useState(
    currentMosqueName || DEFAULT_MOSQUES.find((m) => m.slug === defaultSlug)?.name || ''
  );

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load mosques list for dynamic dropdown (always on mount / defaultSlug change)
    api<MosqueOption[]>(null, '/api/mosques')
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setAllMosques(data);
          const initialSlug = selectedMosqueSlug || defaultSlug;
          const found = data.find((m) => m.slug === initialSlug);
          if (found) {
            setResolvedMosqueName(found.name);
          } else {
            setSelectedMosqueSlug(data[0].slug);
            setResolvedMosqueName(data[0].name);
          }
        }
      })
      .catch(() => {
        // Fallback gracefully to DEFAULT_MOSQUES
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSlug]);

  const config = ROLE_CONFIGS[activeRole];
  const effectiveSlug = selectedMosqueSlug || defaultSlug || 'al-noor';

  const handleRoleChange = (newRole: PortalRole) => {
    setActiveRole(newRole);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleMosqueChange = (slug: string) => {
    setSelectedMosqueSlug(slug);
    const found = allMosques.find((m) => m.slug === slug);
    if (found) setResolvedMosqueName(found.name);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (activeRole === 'operator') {
        // Section 3: Sovereign Platform Operator Login
        const result = await api<{
          token: string;
          csrfToken?: string;
          user?: { user_id: number; name: string; email: string; platform_role?: string };
        }>(null, '/api/platform/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail, password })
        });

        if (result.token && typeof window !== 'undefined') {
          localStorage.setItem('masjidhub:platform:token', result.token);
        }

        setSuccessMsg('Operator credentials verified. Directing to Platform Console…');

        setTimeout(() => {
          router.push('/platform');
        }, 800);
      } else {
        // Section 1 (Member) or Section 2 (Mosque Admin / Imam) Login
        const targetSlug = effectiveSlug;
        const result = await api<{
          token: string;
          csrfToken?: string;
          membership?: { role: string; membership_id?: number };
          user?: { name: string; email: string; user_id?: number };
        }>(targetSlug, '/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: trimmedEmail, password })
        });

        if (typeof window !== 'undefined') {
          localStorage.removeItem('masjidhub:platform:token');
        }
        if (result.token) {
          setToken(targetSlug, result.token);
        }

        // Check all memberships to route admins and officers to the correct workspace
        let finalSlug = targetSlug;
        let isAdminOrOfficer = false;
        let roleTitle = activeRole === 'member' ? 'Member' : 'Mosque Administrator / Imam';

        try {
          const profile = await api<{
            memberships: Array<{
              role: string;
              status: string;
              mosque: { slug: string; name: string };
            }>;
          }>(targetSlug, '/api/auth/me');

          if (profile && profile.memberships && profile.memberships.length > 0) {
            const currentMosqueAdminRole = profile.memberships.find(
              (m) =>
                m.mosque?.slug === targetSlug &&
                m.status === 'Active' &&
                ['tenant_admin', 'programme_officer', 'communications_officer', 'finance_officer'].includes(m.role)
            );

            const anyAdminRole = profile.memberships.find(
              (m) =>
                m.status === 'Active' &&
                ['tenant_admin', 'programme_officer', 'communications_officer', 'finance_officer'].includes(m.role)
            );

            if (currentMosqueAdminRole) {
              isAdminOrOfficer = true;
            } else if (activeRole === 'admin' && anyAdminRole && anyAdminRole.mosque?.slug) {
              finalSlug = anyAdminRole.mosque.slug;
              isAdminOrOfficer = true;
              setToken(finalSlug, result.token);
            } else if (anyAdminRole && anyAdminRole.mosque?.slug) {
              isAdminOrOfficer = true;
              finalSlug = anyAdminRole.mosque.slug;
              setToken(finalSlug, result.token);
            }
          }
        } catch {
          // Fall back gracefully
        }

        const destination =
          activeRole === 'admin' || isAdminOrOfficer
            ? `/mosque/${finalSlug}/admin`
            : `/mosque/${finalSlug}/dashboard`;

        if (isAdminOrOfficer) {
          roleTitle = 'Mosque Administrator / Officer';
        }

        setSuccessMsg(`Authenticated successfully as ${roleTitle}. Opening your workspace…`);

        setTimeout(() => {
          router.push(destination);
        }, 800);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please check your credentials and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid md:grid-cols-12 bg-white rounded-[20px] border-2 border-[#c89b3c]/30 shadow-2xl overflow-hidden w-full animate-fade-in">
      {/* Left Column: Brand, Role Badge & Editorial Access Features */}
      <div className="md:col-span-5 bg-[#0d4734] text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden border-b-2 md:border-b-0 md:border-r-2 border-[#c89b3c]/30">
        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c89b3c] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              {config.badge}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white leading-tight">
            {activeRole === 'member' && (
              <>
                ONE ACCOUNT. <br />
                <span className="italic font-light text-[#c89b3c] lowercase">every</span> MOSQUE.
              </>
            )}
            {activeRole === 'admin' && (
              <>
                SOVEREIGN <br />
                <span className="text-[#c89b3c]">MOSQUE</span> WORKSPACE.
              </>
            )}
            {activeRole === 'operator' && (
              <>
                FEDERATED <br />
                <span className="text-[#c89b3c]">SUPER-ADMIN</span> CONSOLE.
              </>
            )}
          </h1>

          <p className="text-xs text-[#e4efe9] leading-relaxed font-normal">
            {config.description}
          </p>

          {/* Role Feature Highlights */}
          <div className="space-y-4 pt-4 border-t border-[#c89b3c]/30 text-xs font-mono">
            {config.features.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-[#c89b3c] font-black">{feat.icon}</span>
                <div>
                  <strong className="block text-white uppercase text-[11px] font-sans font-bold">
                    {feat.title}
                  </strong>
                  <span className="text-[#e4efe9]/70 text-[10px]">{feat.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Left Bottom Context Meta */}
        <div className="pt-8 border-t border-[#c89b3c]/20 relative z-10 mt-6">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono text-[#c89b3c] uppercase tracking-wider">
              {activeRole === 'operator'
                ? 'Global Super-Admin Terminal'
                : `Target Mosque: ${resolvedMosqueName || effectiveSlug} (/${effectiveSlug})`}
            </span>
            <span className="text-[9px] font-mono text-[#e4efe9]/60">
              Routing: {config.destination.replace('[slug]', effectiveSlug)}
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: 3-Section Segmented Tabs & Responsive Form */}
      <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-between space-y-6 bg-[#fcfbfa]">
        <div>
          {/* 3-Section Role Portal Switcher */}
          <div className="mb-6">
            <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-2">
              SELECT PORTAL SECTION
            </span>
            <div className="grid grid-cols-3 p-1.5 bg-[#f6f3eb] rounded-[12px] border border-[#c89b3c]/30 gap-1">
              <button
                type="button"
                onClick={() => handleRoleChange('member')}
                className={`py-2.5 px-2 text-center rounded-[8px] transition-all flex flex-col items-center justify-center gap-0.5 ${
                  activeRole === 'member'
                    ? 'bg-[#0d4734] text-white shadow-md font-bold'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-white/60 font-semibold'
                }`}
              >
                <span className="text-xs">👤</span>
                <span className="text-[9px] uppercase tracking-wider line-clamp-1">Worshipper</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`py-2.5 px-2 text-center rounded-[8px] transition-all flex flex-col items-center justify-center gap-0.5 ${
                  activeRole === 'admin'
                    ? 'bg-[#0d4734] text-white shadow-md font-bold'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-white/60 font-semibold'
                }`}
              >
                <span className="text-xs">🕌</span>
                <span className="text-[9px] uppercase tracking-wider line-clamp-1">Mosque Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('operator')}
                className={`py-2.5 px-2 text-center rounded-[8px] transition-all flex flex-col items-center justify-center gap-0.5 ${
                  activeRole === 'operator'
                    ? 'bg-[#0d4734] text-white shadow-md font-bold'
                    : 'text-[#1c2421]/70 hover:text-[#0d4734] hover:bg-white/60 font-semibold'
                }`}
              >
                <span className="text-xs">🛡️</span>
                <span className="text-[9px] uppercase tracking-wider line-clamp-1">Operator</span>
              </button>
            </div>
          </div>

          {/* Form Header */}
          <div className="border-b border-[#c89b3c]/20 pb-4 mb-6">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                {config.tagline}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#e4efe9] text-[#0d4734]">
                {activeRole === 'member' ? 'Member Portal' : activeRole === 'admin' ? 'Admin Hub' : 'Super-Admin'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0d4734]">
              {config.title}
            </h2>
            <p className="text-xs text-[#1c2421]/70 mt-1">
              {config.description}
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div
              role="alert"
              className="p-4 mb-5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[8px] animate-fade-in"
            >
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div
              role="status"
              className="p-4 mb-5 bg-[#e4efe9] border border-[#0d4734] text-[#0d4734] text-xs font-bold uppercase rounded-[8px] animate-fade-in"
            >
              {successMsg}
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mosque Selector Dropdown (for Member and Admin portals) */}
            {config.requiresSlug ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label
                    htmlFor="mosque-select"
                    className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60"
                  >
                    Destination Mosque Hub *
                  </label>
                  {isMosquePortal && (
                    <span className="text-[9px] font-bold uppercase text-[#c89b3c]">
                      Current Portal: /{defaultSlug}
                    </span>
                  )}
                </div>
                <select
                  id="mosque-select"
                  value={effectiveSlug}
                  onChange={(e) => handleMosqueChange(e.target.value)}
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734] transition-colors"
                >
                  {allMosques.length > 0 ? (
                    allMosques.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.status === 'Pending' ? '⏳ ' : ''}{m.name} (/{m.slug}){m.status === 'Pending' ? ' — Pending Activation' : ''}
                      </option>
                    ))
                  ) : (
                    <option value={effectiveSlug}>
                      {(resolvedMosqueName || effectiveSlug).toUpperCase()} (/{effectiveSlug})
                    </option>
                  )}
                </select>
              </div>
            ) : (
              <div className="p-3 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block">
                    Scope: Sovereign Super-Admin
                  </span>
                  <span className="text-[10px] text-[#1c2421]/60">
                    Direct access to platform-wide multi-tenant governance.
                  </span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-[#0d4734] text-white px-2.5 py-1 rounded-[4px]">
                  /platform
                </span>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label
                htmlFor="auth-email"
                className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1"
              >
                {config.emailLabel}
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={config.emailPlaceholder}
                className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734] transition-colors"
                required
              />
            </div>

            {/* Password Input with Toggle */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="auth-password"
                  className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60"
                >
                  Password / Security Key *
                </label>
                <div className="flex items-center gap-3">
                  <Link
                    href="/forgot-password"
                    className="text-[9px] font-bold uppercase text-[#c89b3c] hover:text-[#0d4734] transition-colors"
                  >
                    Forgot Password?
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[9px] font-bold uppercase text-[#1c2421]/60 hover:text-[#0d4734] transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config.passwordPlaceholder}
                className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734] transition-colors"
                required
              />
              <div className="flex justify-end pt-1">
                <Link
                  href="/forgot-password"
                  className="text-[10px] font-black uppercase tracking-wider text-[#c89b3c] hover:text-[#0d4734] transition-colors flex items-center gap-1"
                >
                  <span>🔑</span>
                  <span>Forgot Password? Reset Here &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Submit CTA Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pill-cta w-full py-3.5 tracking-ultra-wide"
              >
                {isSubmitting ? config.buttonLoading : config.buttonText}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Quick Links & Onboarding Gateways */}
        <div className="pt-6 border-t border-[#c89b3c]/20 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span className="text-[#1c2421]/60 font-normal">
              {activeRole === 'member'
                ? "Don't have a worshipper account yet?"
                : activeRole === 'admin'
                ? 'Looking to onboard a new mosque tenant?'
                : 'Need to register a new congregation?'}
            </span>
            <Link
              href={
                isMosquePortal && activeRole === 'member'
                  ? `/mosque/${effectiveSlug}/register`
                  : '/register'
              }
              className="btn-pill-secondary py-1.5 px-4 text-[9px] tracking-widest text-center"
            >
              {activeRole === 'member'
                ? 'CREATE ACCOUNT →'
                : 'ONBOARD MOSQUE →'}
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-[#c89b3c]/10 text-xs">
            <span className="text-[#1c2421]/60 font-normal">
              Trouble logging in or forgotten password?
            </span>
            <Link
              href="/forgot-password"
              className="text-[9px] font-black uppercase tracking-wider text-[#c89b3c] hover:text-[#0d4734] transition-colors"
            >
              Reset Credentials &rarr;
            </Link>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 text-[10px] font-bold text-[#1c2421]/50 pt-2">
            {activeRole !== 'operator' ? (
              <button
                type="button"
                onClick={() => handleRoleChange('operator')}
                className="hover:text-[#0d4734] transition-colors uppercase cursor-pointer"
              >
                Platform Operator Console &rarr;
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleRoleChange('member')}
                className="hover:text-[#0d4734] transition-colors uppercase cursor-pointer"
              >
                &larr; Worshipper / Member Sign-In
              </button>
            )}

            <Link href="/register" className="hover:text-[#c89b3c] transition-colors uppercase">
              Register a New Mosque &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
