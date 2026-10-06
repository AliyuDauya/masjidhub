'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import BackButton from '@/components/BackButton';

interface MosqueOption {
  mosque_id: number;
  name: string;
  slug: string;
}

const DEFAULT_MOSQUES: MosqueOption[] = [
  { mosque_id: 1, name: 'Al-Noor Central Masjid', slug: 'al-noor' },
  { mosque_id: 2, name: 'Masjid Al-Huda', slug: 'al-huda' },
  { mosque_id: 3, name: 'Al-Iman Islamic Center', slug: 'al-iman' }
];

export default function GlobalRegisterPage() {
  const router = useRouter();

  // Toggle Mode: 'user' | 'mosque'
  const [registerMode, setRegisterMode] = useState<'user' | 'mosque'>('user');

  // Worshipper / User Form State
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [selectedMosqueSlug, setSelectedMosqueSlug] = useState('al-noor');

  // Mosque Tenant Form State
  const [mosqueName, setMosqueName] = useState('');
  const [mosqueSlug, setMosqueSlug] = useState('');
  const [mosqueAddress, setMosqueAddress] = useState('');
  const [mosqueEmail, setMosqueEmail] = useState('');
  const [mosquePhone, setMosquePhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [allMosques, setAllMosques] = useState<MosqueOption[]>(DEFAULT_MOSQUES);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load active mosques for member selection
    api<MosqueOption[]>(null, '/api/mosques')
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setAllMosques(data);
          if (!data.some((m) => m.slug === selectedMosqueSlug)) {
            setSelectedMosqueSlug(data[0].slug);
          }
        }
      })
      .catch(() => {});
  }, []);

  function handleMosqueNameChange(val: string) {
    setMosqueName(val);
    if (!mosqueSlug || mosqueSlug === mosqueName.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      const clean = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      setMosqueSlug(clean);
    }
  }

  // Handle Worshipper / User Registration
  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!userName.trim() || !userEmail.trim() || !userPassword) {
      setErrorMsg('Please fill in your name, email, and password.');
      return;
    }

    if (userPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetSlug = selectedMosqueSlug || 'al-noor';
      const result = await api<{ token: string; message?: string }>(
        targetSlug,
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            name: userName.trim(),
            email: userEmail.trim(),
            password: userPassword,
            phone: userPhone.trim() || undefined
          })
        }
      );
      if (result.token) {
        setToken(targetSlug, result.token);
      }
      setSuccessMsg('Your global account has been created. Redirecting to your member dashboard…');
      setTimeout(() => {
        router.push(`/mosque/${targetSlug}/dashboard`);
      }, 1000);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Mosque Onboarding Registration
  const handleMosqueRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanSlug = mosqueSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

    if (!mosqueName.trim() || !cleanSlug || !adminName.trim() || !adminEmail.trim() || !adminPassword) {
      setErrorMsg('Please provide mosque name, slug, and complete administrator details.');
      return;
    }

    if (adminPassword.length < 8) {
      setErrorMsg('Administrator password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api<{ name: string; slug: string; message: string }>(
        null,
        '/api/mosques',
        {
          method: 'POST',
          body: JSON.stringify({
            name: mosqueName.trim(),
            slug: cleanSlug,
            address: mosqueAddress.trim() || undefined,
            email: mosqueEmail.trim() || undefined,
            phone: mosquePhone.trim() || undefined,
            admin_name: adminName.trim(),
            admin_email: adminEmail.trim(),
            admin_password: adminPassword
          })
        }
      );

      setSuccessMsg(`Mosque "${res.name}" registered successfully! Redirecting to mosque portal…`);
      setTimeout(() => {
        router.push(`/mosque/${cleanSlug}`);
      }, 1500);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Mosque registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/" />
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40 hidden sm:inline">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] hidden sm:inline">
            GLOBAL REGISTRATION
          </span>
        </div>
        <Link
          href="/"
          className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors"
        >
          HOME &rarr;
        </Link>
      </header>

      {/* Main Registration Card */}
      <main className="flex items-center justify-center p-6 py-16 flex-grow">
        <div className="bg-white max-w-xl w-full p-8 md:p-12 rounded-[16px] border-2 border-[#c89b3c]/30 shadow-2xl relative animate-fade-in space-y-6">
          {/* Header Title */}
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
              SOVEREIGN MASJIDHUB ACCESS
            </span>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-[#0d4734]">
              {registerMode === 'user' ? 'JOIN AS A MEMBER' : 'REGISTER A MOSQUE'}
            </h1>
            <p className="text-xs text-[#1c2421]/70 mt-1 font-normal">
              {registerMode === 'user'
                ? 'Create your single global account to reserve seats, donate, and join any mosque.'
                : 'Onboard your mosque with sovereign prayer timetables, treasury ledgers, and programmes.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#f6f3eb] rounded-[10px] border border-[#c89b3c]/25">
            <button
              type="button"
              onClick={() => {
                setRegisterMode('user');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2.5 px-4 text-xs font-black uppercase tracking-wider rounded-[8px] transition-all ${
                registerMode === 'user'
                  ? 'bg-[#0d4734] text-white shadow-md'
                  : 'text-[#1c2421]/60 hover:text-[#0d4734]'
              }`}
            >
              👤 Register as User
            </button>
            <button
              type="button"
              onClick={() => {
                setRegisterMode('mosque');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2.5 px-4 text-xs font-black uppercase tracking-wider rounded-[8px] transition-all ${
                registerMode === 'mosque'
                  ? 'bg-[#0d4734] text-white shadow-md'
                  : 'text-[#1c2421]/60 hover:text-[#0d4734]'
              }`}
            >
              🕌 Register as Mosque
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-[#e4efe9] border border-[#0d4734] text-[#0d4734] text-xs font-bold uppercase rounded-[6px]">
              {successMsg}
            </div>
          )}

          {/* FORM 1: REGISTER AS WORSHIPPER / USER */}
          {registerMode === 'user' && (
            <form onSubmit={handleUserRegister} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="E.G. AHMAD ALI"
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Email Address (Global Single Sign-On) *
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="NAME@EXAMPLE.COM"
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Create Password (Min. 8 Characters) *
                </label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Primary Mosque Congregation
                </label>
                <select
                  value={selectedMosqueSlug}
                  onChange={(e) => setSelectedMosqueSlug(e.target.value)}
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                >
                  {allMosques.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name} (/{m.slug})
                    </option>
                  ))}
                </select>
                <span className="text-[9px] text-[#1c2421]/50 block mt-1">
                  ✦ You can join other mosques with 1 click anytime from your dashboard.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pill-cta w-full py-3.5 tracking-ultra-wide mt-2"
              >
                {isSubmitting ? 'REGISTERING…' : 'CREATE USER ACCOUNT & JOIN →'}
              </button>
            </form>
          )}

          {/* FORM 2: REGISTER AS MOSQUE */}
          {registerMode === 'mosque' && (
            <form onSubmit={handleMosqueRegister} className="space-y-4">
              <div className="space-y-3 p-4 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20">
                <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block">
                  1. MOSQUE IDENTITY
                </span>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[#1c2421]/60 block mb-1">
                    Mosque Full Name *
                  </label>
                  <input
                    type="text"
                    value={mosqueName}
                    onChange={(e) => handleMosqueNameChange(e.target.value)}
                    placeholder="E.G. BAITUL MUKARRAM CENTRAL MOSQUE"
                    className="w-full bg-white border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#1c2421]/60 block mb-1">
                      Mosque URL Slug *
                    </label>
                    <input
                      type="text"
                      value={mosqueSlug}
                      onChange={(e) => setMosqueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="baitul-mukarram"
                      className="w-full bg-white border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-mono font-bold text-[#0d4734] focus:outline-none focus:border-[#0d4734]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#1c2421]/60 block mb-1">
                      Physical Address
                    </label>
                    <input
                      type="text"
                      value={mosqueAddress}
                      onChange={(e) => setMosqueAddress(e.target.value)}
                      placeholder="CITY, STATE / REGION"
                      className="w-full bg-white border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20">
                <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block">
                  2. ADMINISTRATOR CREDENTIALS
                </span>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[#1c2421]/60 block mb-1">
                    Admin Full Name *
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="IMAM / SECRETARY NAME"
                    className="w-full bg-white border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#1c2421]/60 block mb-1">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="ADMIN@MOSQUE.ORG"
                      className="w-full bg-white border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#1c2421]/60 block mb-1">
                      Admin Password (Min 8 Chars) *
                    </label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pill-cta w-full py-3.5 tracking-ultra-wide mt-2"
              >
                {isSubmitting ? 'ONBOARDING MOSQUE…' : 'ONBOARD MOSQUE TENANT →'}
              </button>
            </form>
          )}

          {/* Footer Sign-In Redirection */}
          <p className="text-center text-xs text-[#1c2421]/60 pt-4 border-t border-[#c89b3c]/20 font-normal">
            Already have an account?{' '}
            <Link
              href="/mosque/al-noor/login"
              className="text-[#0d4734] font-black hover:text-[#c89b3c] transition-colors ml-1 uppercase"
            >
              Sign In to Portal &rarr;
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        <span suppressHydrationWarning> {new Date().getFullYear()}</span> MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
