'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface MosqueMock {
  name: string;
  slug: string;
  address?: string;
}

export default function MasjidHubLuxuryLandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedMosqueSlug, setSelectedMosqueSlug] = useState('al-noor');
  const [mosques, setMosques] = useState<MosqueMock[]>([]);
  const [loading, setLoading] = useState(true);

  // Mosque Registration Form State
  const [modalRegisterMode, setModalRegisterMode] = useState<'user' | 'mosque'>('user');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [selectedUserMosque, setSelectedUserMosque] = useState('al-noor');

  const [newMosqueName, setNewMosqueName] = useState('');
  const [newMosqueSlug, setNewMosqueSlug] = useState('');
  const [newMosqueAddress, setNewMosqueAddress] = useState('');
  const [newMosqueEmail, setNewMosqueEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fallback demo mosques if backend is starting
  const defaultMosques: MosqueMock[] = [
    {
      name: 'Al-Noor Islamic Cultural Centre',
      slug: 'al-noor',
      address: '142 Regent Street, London W1B 5AH',
    },
    {
      name: 'Baitul Mukarram Central Mosque',
      slug: 'baitul-mukarram',
      address: '88 Commercial Road, Tower Hamlets, London',
    },
    {
      name: 'Al-Falah Community Masjid',
      slug: 'al-falah',
      address: '24 Victoria Road, Manchester M14 6AQ',
    },
    {
      name: 'Madina Grand Jamia Masjid',
      slug: 'madina-grand',
      address: '55 Stratford Road, Birmingham B11 1AN',
    },
  ];

  useEffect(() => {
    api<MosqueMock[]>(null, '/api/mosques')
      .then((data) => {
        if (data && data.length > 0) {
          setMosques(data);
        } else {
          setMosques(defaultMosques);
        }
      })
      .catch(() => {
        setMosques(defaultMosques);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const observerCallback: IntersectionObserverCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    });

    const elements = document.querySelectorAll('.reveal-up');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [mosques]);

  const filteredMosques = mosques.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.address && m.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleUserRegisterModal = async (e: React.FormEvent) => {
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

    try {
      const targetSlug = selectedUserMosque || 'al-noor';
      await api(targetSlug, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: userName.trim(),
          email: userEmail.trim(),
          password: userPassword,
          phone: userPhone.trim() || undefined
        })
      });
      setSuccessMsg(`Global account registered and joined ${targetSlug} congregation.`);
      setTimeout(() => {
        window.location.href = `/mosque/${targetSlug}/dashboard`;
      }, 1200);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'User registration failed.');
    }
  };

  const handleRegisterMosque = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newMosqueName || !newMosqueSlug || !adminName || !adminEmail || !adminPassword) {
      setErrorMsg('Mosque name, slug, administrator name, email, and password are required.');
      return;
    }

    const cleanSlug = newMosqueSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');

    try {
      await api(null, '/api/mosques', {
        method: 'POST',
        body: JSON.stringify({
          name: newMosqueName,
          slug: cleanSlug,
          address: newMosqueAddress,
          email: newMosqueEmail,
          admin_name: adminName,
          admin_email: adminEmail,
          admin_password: adminPassword,
        }),
      });
      setSuccessMsg('Mosque application submitted. Platform administrators will activate the portal.');
      
      setMosques((prev) => [
        ...prev,
        { name: newMosqueName, slug: cleanSlug, address: newMosqueAddress },
      ]);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Submission failed.');
      return;
    }

    setNewMosqueName('');
    setNewMosqueSlug('');
    setNewMosqueAddress('');
    setNewMosqueEmail('');
    setAdminName('');
    setAdminEmail('');
    setAdminPassword('');

    setTimeout(() => {
      setShowRegisterModal(false);
      setSuccessMsg('');
    }, 2500);
  };

  const capabilities = [
    {
      num: '01',
      title: 'IQAMAH SYNCHRONIZATION',
      desc: 'Real-time 5-slot automated prayer calculations and instantaneous timetable dissemination to displays, mobiles, and worshippers.',
      icon: '✦',
    },
    {
      num: '02',
      title: 'CRYPTOGRAPHIC GIVING',
      desc: 'Fully verifiable donation ledgers with automated instant tax receipting, dedicated fund allocations, and zero intermediary leakage.',
      icon: '❖',
    },
    {
      num: '03',
      title: 'COMMUNITY DISPATCHES',
      desc: 'Instant noticeboard dispatches, structured educational circles, and seat reservations governed under sovereign tenant spaces.',
      icon: '◈',
    },
  ];

  const mosqueImages = [
    'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519817650390-64a93db51149?q=80&w=1200&auto=format&fit=crop',
  ];

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734]">
      {/* 80px Fixed Glassmorphism Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 nav-glass flex items-center">
        <div className="max-w-7xl w-full mx-auto px-8 md:px-12 flex items-center justify-between">
          {/* Brand Logo with Gold Trim */}
          <Link href="/" className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3 group">
            <span className="w-3.5 h-3.5 rounded-full bg-[#c89b3c] group-hover:scale-125 transition-transform shadow-xs" />
            <span className="tracking-tight">MASJIDHUB</span>
          </Link>

          {/* Center Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-10">
            <a href="#directory" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] transition-colors">
              DIRECTORY
            </a>
            <a href="#capabilities" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] transition-colors">
              CAPABILITIES
            </a>
            <a href="#architecture" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] transition-colors">
              ARCHITECTURE
            </a>
            <Link href="/platform" className="text-[10px] font-black uppercase tracking-menu text-[#c89b3c] hover:text-[#0d4734] transition-colors font-bold">
              PLATFORM CONSOLE
            </Link>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[10px] font-black uppercase tracking-menu text-[#0d4734] hover:text-[#c89b3c] px-3 py-2 transition-colors hidden sm:inline-block"
            >
              LOGIN
            </Link>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="btn-pill-cta"
            >
              REGISTER
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section (Full Viewport Height) */}
      <section className="min-h-screen pt-32 pb-20 md:pt-40 md:pb-28 px-8 md:px-12 flex items-center relative overflow-hidden">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Massive Headline, Action Buttons & Search */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-block">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-4">
                01 / MULTI-TENANT MOSQUE INFRASTRUCTURE
              </span>
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[9.5vw] font-black uppercase tracking-tighter leading-[0.8] text-[#0d4734]">
                SOVEREIGN <br />
                <span className="italic font-light lowercase text-[#c89b3c]">mosque</span> <br />
                OPERATIONS
              </h1>
            </div>

            <p className="text-xl md:text-2xl text-[#1c2421]/75 max-w-xl font-normal leading-relaxed">
              An architectural digital ecosystem uniting synchronized prayer timetables, auditable donation ledgers, and autonomous community governance.
            </p>

            {/* Hero Login & Register Action Cluster */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="btn-pill-cta py-3.5 px-8 text-xs tracking-ultra-wide"
              >
                REGISTER MOSQUE
              </button>
              <Link
                href="/login"
                className="btn-pill-secondary py-3.5 px-8 text-xs tracking-ultra-wide text-center"
              >
                SIGN IN
              </Link>
            </div>

            {/* Quick Search & Explore CTA */}
            <div className="space-y-4 pt-2">
              <div className="max-w-md bg-white border border-[#c89b3c]/30 p-2 rounded-[6px] shadow-sm flex items-center gap-2">
                <input
                  type="text"
                  placeholder="SEARCH MOSQUE (E.G. AL-NOOR, LONDON)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent text-xs font-bold uppercase tracking-wider text-[#1c2421] focus:outline-none placeholder:text-[#888888]"
                />
                <a
                  href="#directory"
                  className="btn-pill-gold text-[9px] py-2.5 px-4 whitespace-nowrap"
                >
                  SEARCH INDEX
                </a>
              </div>

              <div>
                <a href="#directory" className="arrow-cta group">
                  <span>BROWSE REGISTERED MOSQUE PORTALS</span>
                  <span className="text-lg transition-transform group-hover:translate-x-2">&rarr;</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Image Card with Floating Green & Gold Badge */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="hero-img-card relative w-full aspect-[4/5] max-w-md rounded-[24px] overflow-hidden shadow-2xl border-2 border-[#c89b3c]/20">
              <img
                src={mosqueImages[0]}
                alt="Sovereign Mosque Sanctuary"
                className="w-full h-full object-cover grayscale-img"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d4734]/75 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-6 left-6 right-6 text-white pointer-events-none">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                  TENANT PORTAL PREVIEW
                </span>
                <p className="text-lg font-bold text-white">Autonomous Mosque Infrastructure</p>
              </div>
            </div>

            {/* Floating 160px Green & Gold Concierge Badge */}
            <div className="floating-badge absolute -bottom-8 -left-8 md:-left-12 z-20">
              <span className="text-4xl font-black italic mb-1 text-[#c89b3c]">01</span>
              <span className="text-[8px] font-black uppercase tracking-ultra-wide text-center px-4 text-[#e4efe9]">
                TENANT ISOLATION
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Section (Background #f6f3eb) */}
      <section id="capabilities" className="bg-[#f6f3eb] py-32 px-8 md:px-12 border-t border-[#c89b3c]/20">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="reveal-up space-y-6">
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              02 / CORE CAPABILITIES
            </span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl font-black uppercase tracking-tighter text-[#0d4734]">
              ENGINEERED TRUST
            </h2>
          </div>

          {/* 3-Column Services / Capabilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {capabilities.map((cap) => (
              <div
                key={cap.num}
                className="service-card reveal-up rounded-[6px] flex flex-col justify-between min-h-[360px] cursor-pointer group shadow-xs"
              >
                <div>
                  <div className="flex justify-between items-start mb-8">
                    <span className="service-num text-[10px] font-black uppercase tracking-ultra-wide opacity-80">
                      {cap.num}
                    </span>
                    <span className="service-icon text-4xl">{cap.icon}</span>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-4 text-[#0d4734]">
                    {cap.title}
                  </h3>
                  <p className="text-sm text-[#1c2421]/75 leading-relaxed font-normal">
                    {cap.desc}
                  </p>
                </div>

                <div className="pt-8">
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] flex items-center gap-2">
                    <span>EXPLORE CAPABILITY</span>
                    <span>&rarr;</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Staggered Mosque Directory Section */}
      <section id="directory" className="py-36 px-8 md:px-12 bg-[#fcfbfa]">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="reveal-up max-w-3xl space-y-6">
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              03 / VERIFIED TENANTS
            </span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl font-black uppercase tracking-tighter text-[#0d4734]">
              MOSQUE DIRECTORY
            </h2>
            <p className="text-xl text-[#1c2421]/75 leading-relaxed">
              Every registered mosque operates with sovereign data isolation, dedicated donation ledgers, and synchronized prayer timetables.
            </p>
          </div>

          {/* 2-Column Staggered Grid */}
          {loading ? (
            <div className="p-16 border border-[#c89b3c]/20 text-center font-bold uppercase tracking-widest text-xs text-[#0d4734]">
              LOADING MOSQUE DIRECTORY…
            </div>
          ) : filteredMosques.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
              {filteredMosques.map((mosque, idx) => {
                const isEven = idx % 2 === 1;
                const img = mosqueImages[idx % mosqueImages.length];
                return (
                  <div
                    key={mosque.slug}
                    className={`reveal-up space-y-6 ${isEven ? 'md:translate-y-[100px]' : ''}`}
                  >
                    {/* 3:4 Aspect Ratio Image Card with Hover View Case Overlay */}
                    <Link
                      href={`/mosque/${mosque.slug}`}
                      className="portfolio-container relative aspect-[3/4] rounded-[16px] overflow-hidden cursor-pointer shadow-lg block group border border-[#c89b3c]/20"
                    >
                      <img
                        src={img}
                        alt={mosque.name}
                        className="w-full h-full object-cover grayscale-img"
                      />
                      <div className="view-case-circle absolute inset-0 flex items-center justify-center">
                        <div className="w-28 h-28 bg-[#0d4734] border-2 border-[#c89b3c] rounded-full flex flex-col items-center justify-center shadow-2xl">
                          <span className="text-[10px] font-black text-white uppercase tracking-menu">
                            Enter Portal
                          </span>
                          <span className="text-[8px] text-[#c89b3c] font-black tracking-widest mt-1">
                            /{mosque.slug}
                          </span>
                        </div>
                      </div>
                    </Link>

                    {/* Metadata */}
                    <div className="pt-2">
                      <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
                        /{mosque.slug} • VERIFIED TENANT
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[#0d4734] mb-2">
                        {mosque.name}
                      </h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#1c2421]/50">
                        {mosque.address || 'Address unlisted'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 border border-[#c89b3c]/20 text-center rounded-[12px] bg-[#f6f3eb]">
              <p className="text-2xl font-black uppercase text-[#0d4734] mb-3">No matching mosques found</p>
              <p className="text-sm text-[#1c2421]/70 mb-6 font-normal">
                You can onboard and register your local congregation in minutes.
              </p>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="btn-pill-cta"
              >
                REGISTER NEW MOSQUE
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Architecture & Governance Section */}
      <section id="architecture" className="bg-[#f6f3eb] py-32 px-8 md:px-12 border-t border-[#c89b3c]/20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-6 space-y-8 reveal-up">
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
              04 / GOVERNANCE ARCHITECTURE
            </span>
            <h2 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter leading-[0.85] text-[#0d4734]">
              AUTONOMY WITH <br />
              <span className="italic font-light lowercase text-[#c89b3c]">central</span> RELIABILITY
            </h2>
            <p className="text-lg text-[#1c2421]/75 leading-relaxed font-normal">
              Unlike generic shared software, MasjidHub enforces database row-level tenant security, customizable brand color identities, and isolated financial ledgers so your mosque retains full sovereignty.
            </p>
            <div className="pt-4 flex flex-wrap gap-4">
              <Link href="/platform" className="btn-pill-cta">
                ACCESS PLATFORM CONSOLE
              </Link>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="arrow-cta"
              >
                <span>APPLY FOR TENANT ONBOARDING</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 border-2 border-[#c89b3c]/30 bg-white p-8 md:p-12 rounded-[16px] space-y-6 shadow-md reveal-up">
            <div className="flex justify-between items-center border-b border-[#c89b3c]/20 pb-4">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                OPERATING SPECIFICATION
              </span>
              <span className="text-xs font-mono font-bold text-[#0d4734] bg-[#e4efe9] px-2.5 py-1 rounded-[4px]">
                TLS 1.3 SECURE
              </span>
            </div>
            <div className="space-y-4 font-mono text-xs text-[#1c2421]/80 leading-relaxed">
              <p>• MULTI-TENANT ISOLATION: Strict cryptographic separation</p>
              <p>• PRAYER TIME CALCULATION: Dynamic localized Iqamah engine</p>
              <p>• GIVING RECONCILIATION: Instant verified digital receipts</p>
              <p>• NOTICEBOARD DISPATCHES: Instant WebSocket sync across devices</p>
            </div>
          </div>
        </div>
      </section>

      {/* 12-Column Luxury Editorial Footer (Background #f6f3eb) */}
      <footer className="bg-[#f6f3eb] pt-32 pb-16 px-8 md:px-12 border-t border-[#c89b3c]/20">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 border-b border-[#c89b3c]/15 pb-20">
            {/* Left 5 Columns: Brand & Mission */}
            <div className="lg:col-span-5 space-y-6">
              <div className="text-3xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
                <span>MASJIDHUB</span>
              </div>
              <p className="text-lg text-[#1c2421]/75 max-w-sm font-normal leading-relaxed">
                Empowering sovereign Muslim communities with unified digital operations, transparent stewardship, and synchronized prayer infrastructure.
              </p>
              <div className="pt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="btn-pill-gold"
                >
                  REGISTER YOUR MOSQUE
                </button>
                <Link
                  href="/login"
                  className="btn-pill-secondary text-center"
                >
                  SIGN IN
                </Link>
              </div>
            </div>

            {/* Right 7 Columns: 3 Sub-Columns */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-10">
              {/* Navigation Column */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] mb-8 footer-underline inline-block">
                  DIRECTORY INDEX
                </h4>
                <ul className="space-y-4">
                  <li>
                    <a href="#directory" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] hover:translate-x-1 inline-block transition-transform">
                      Mosques Index
                    </a>
                  </li>
                  <li>
                    <a href="#capabilities" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] hover:translate-x-1 inline-block transition-transform">
                      Iqamah Timetable
                    </a>
                  </li>
                  <li>
                    <a href="#capabilities" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] hover:translate-x-1 inline-block transition-transform">
                      Giving Ledgers
                    </a>
                  </li>
                  <li>
                    <a href="#architecture" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] hover:translate-x-1 inline-block transition-transform">
                      Architecture
                    </a>
                  </li>
                </ul>
              </div>

              {/* Platform Column */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] mb-8 footer-underline inline-block">
                  PLATFORM OPS
                </h4>
                <ul className="space-y-4">
                  <li>
                    <Link href="/platform" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] hover:translate-x-1 inline-block transition-transform">
                      Platform Console
                    </Link>
                  </li>
                  <li>
                    <Link href="/mosque/al-noor/admin" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] hover:translate-x-1 inline-block transition-transform">
                      Tenant Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="text-[10px] font-black uppercase tracking-menu text-[#1c2421] hover:text-[#c89b3c] hover:translate-x-1 inline-block transition-transform">
                      Member & Admin Sign In
                    </Link>
                  </li>
                  <li>
                    <span className="text-[10px] font-black uppercase tracking-menu text-[#0d4734] font-bold">
                      Status: 200 Nominal
                    </span>
                  </li>
                </ul>
              </div>

              {/* Locations Column */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] mb-8 footer-underline inline-block">
                  REGIONAL HUBS
                </h4>
                <ul className="space-y-4">
                  <li className="text-[10px] font-black uppercase tracking-menu opacity-60">
                    London Region
                  </li>
                  <li className="text-[10px] font-black uppercase tracking-menu opacity-60">
                    Manchester Central
                  </li>
                  <li className="text-[10px] font-black uppercase tracking-menu opacity-60">
                    Birmingham South
                  </li>
                  <li className="text-[10px] font-black uppercase tracking-menu opacity-60">
                    Global Network
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
            <div>
              <span suppressHydrationWarning> {new Date().getFullYear()}</span> MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
            </div>
            <div className="flex gap-8">
              <a href="#" className="hover:text-[#0d4734] transition-colors">Privacy Protocol</a>
              <a href="#" className="hover:text-[#0d4734] transition-colors">Sovereign Terms</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Onboarding Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#fcfbfa] max-w-xl w-full p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/30 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-5">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute top-6 right-6 text-xs font-black uppercase tracking-widest text-[#1c2421]/60 hover:text-[#1c2421]"
            >
              [CLOSE ×]
            </button>

            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                MASJIDHUB ACCESS PORTAL
              </span>
              <h3 className="text-3xl font-black uppercase tracking-tighter text-[#0d4734]">
                {modalRegisterMode === 'user' ? 'JOIN AS A MEMBER' : 'REGISTER A MOSQUE'}
              </h3>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-[#f6f3eb] rounded-[10px] border border-[#c89b3c]/25">
              <button
                type="button"
                onClick={() => {
                  setModalRegisterMode('user');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2 px-3 text-xs font-black uppercase tracking-wider rounded-[8px] transition-all ${
                  modalRegisterMode === 'user'
                    ? 'bg-[#0d4734] text-white shadow-md'
                    : 'text-[#1c2421]/60 hover:text-[#0d4734]'
                }`}
              >
                👤 Register as User
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalRegisterMode('mosque');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2 px-3 text-xs font-black uppercase tracking-wider rounded-[8px] transition-all ${
                  modalRegisterMode === 'mosque'
                    ? 'bg-[#0d4734] text-white shadow-md'
                    : 'text-[#1c2421]/60 hover:text-[#0d4734]'
                }`}
              >
                🕌 Register as Mosque
              </button>
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
                {errorMsg}
              </div>
            )}

            {successMsg ? (
              <div className="p-6 bg-[#e4efe9] border border-[#0d4734] rounded-[8px] text-center space-y-2">
                <p className="font-black text-sm uppercase tracking-wide text-[#0d4734]">
                  Registration Successful
                </p>
                <p className="text-xs text-[#1c2421]/75">
                  {successMsg}
                </p>
              </div>
            ) : modalRegisterMode === 'user' ? (
              /* USER REGISTRATION FORM */
              <form onSubmit={handleUserRegisterModal} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.G. AHMAD ALI"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2.5 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Email Address (Global Account) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="NAME@EXAMPLE.COM"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2.5 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Create Password (Min. 8 Characters) *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2.5 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2.5 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Primary Mosque Congregation
                  </label>
                  <select
                    value={selectedUserMosque}
                    onChange={(e) => setSelectedUserMosque(e.target.value)}
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  >
                    {mosques.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.name} (/{m.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="btn-pill-cta w-full py-3.5 tracking-ultra-wide"
                  >
                    CREATE USER ACCOUNT &rarr;
                  </button>
                </div>
              </form>
            ) : (
              /* MOSQUE REGISTRATION FORM */
              <form onSubmit={handleRegisterMosque} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Mosque Legal Entity Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.G. AL-NOOR ISLAMIC CENTRE"
                    value={newMosqueName}
                    onChange={(e) => {
                      setNewMosqueName(e.target.value);
                      if (!newMosqueSlug) {
                        setNewMosqueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                      }
                    }}
                    className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Portal Slug *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="al-noor"
                      value={newMosqueSlug}
                      onChange={(e) => setNewMosqueSlug(e.target.value)}
                      className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2 text-xs font-mono font-bold text-[#0d4734] focus:outline-none focus:border-[#c89b3c]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      placeholder="INFO@MOSQUE.ORG"
                      value={newMosqueEmail}
                      onChange={(e) => setNewMosqueEmail(e.target.value)}
                      className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    placeholder="123 MAIN ST, LONDON"
                    value={newMosqueAddress}
                    onChange={(e) => setNewMosqueAddress(e.target.value)}
                    className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Lead Admin Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Administrator full name"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Administrator sign-in email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#c89b3c]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Admin Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Password (at least 8 characters)"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-transparent border-b border-[#c89b3c]/30 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-[#c89b3c]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="btn-pill-cta w-full py-3.5 tracking-ultra-wide"
                  >
                    ONBOARD MOSQUE TENANT &rarr;
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
