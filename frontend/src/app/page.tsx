'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface MosqueMock {
  name: string;
  slug: string;
  address?: string;
}

export default function GlobalLandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  // Registration Form State
  const [newMosqueName, setNewMosqueName] = useState('');
  const [newMosqueSlug, setNewMosqueSlug] = useState('');
  const [newMosqueAddress, setNewMosqueAddress] = useState('');
  const [newMosqueEmail, setNewMosqueEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sample static seed for demonstration
  const [mosques, setMosques] = useState<MosqueMock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api<MosqueMock[]>(null, '/api/mosques').then(setMosques).catch(e => setErrorMsg(e.message)).finally(() => setLoading(false)); }, []);

  const filteredMosques = mosques.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRegisterMosque = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newMosqueName || !newMosqueSlug || !adminName || !adminEmail || !adminPassword) {
      setErrorMsg('Mosque and administrator details are required.');
      return;
    }

    const cleanSlug = newMosqueSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');

    // Check duplication
    if (mosques.some((m) => m.slug === cleanSlug)) {
      setErrorMsg('A mosque with this slug already exists.');
      return;
    }

    try {
      await api(null, '/api/mosques', { method: 'POST', body: JSON.stringify({ name: newMosqueName, slug: cleanSlug, address: newMosqueAddress, email: newMosqueEmail, admin_name: adminName, admin_email: adminEmail, admin_password: adminPassword }) });
      setSuccessMsg('Application received. A platform administrator must activate the mosque before sign-in.');
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Application failed.'); return; }
    
    // Reset Form
    setNewMosqueName('');
    setNewMosqueSlug('');
    setNewMosqueAddress('');
    setNewMosqueEmail('');
    setAdminName(''); setAdminEmail(''); setAdminPassword('');

    setTimeout(() => {
      setShowRegisterModal(false);
      setSuccessMsg('');
    }, 2000);
  };

  return (
    <main className="min-h-screen flex flex-col justify-between">
      {/* Premium Hero Banner */}
      <section className="masjid-gradient-bg text-white py-20 px-6 text-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-300 via-emerald-800 to-green-950"></div>
        <div className="max-w-4xl mx-auto relative z-10 animate-fade-in">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">MasjidHub</h1>
          <p className="text-xl text-emerald-200 max-w-2xl mx-auto mb-8 font-light">
            A unified multi-tenant administrative ecosystem for managing donations, announcements, and religious programs.
          </p>
          
          {/* Main search and Register Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-lg mx-auto">
            <input
              type="text"
              placeholder="Search your local mosque (e.g., al-noor)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-none text-slate-900 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            <button
              onClick={() => setShowRegisterModal(true)}
              className="w-full sm:w-auto px-6 py-3 font-semibold bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-md transition-all whitespace-nowrap"
            >
              Register Mosque
            </button>
          </div>
        </div>
      </section>

      {/* Mosque List Section */}
      <section className="max-w-5xl mx-auto px-6 py-12 flex-grow w-full">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">Registered Mosques</h2>
        {loading ? <p className="text-slate-500">Loading mosque directory…</p> : filteredMosques.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-6">
            {filteredMosques.map((mosque) => (
              <div key={mosque.slug} className="card-premium flex flex-col justify-between h-52">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{mosque.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{mosque.address || 'Address not published'}</p>
                </div>
                <Link
                  href={`/mosque/${mosque.slug}`}
                  className="btn-primary w-full text-center"
                >
                  Enter Portal
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-lg text-slate-500 dark:text-slate-400">No mosques found matching your search.</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} MasjidHub. Scaffolding dynamic community networks.</p>
      </footer>

      {/* Onboarding Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200 dark:border-slate-700 animate-fade-in">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
            >
              ✕
            </button>
            <h3 className="text-2xl font-bold mb-4 text-slate-800 dark:text-white">Register Your Mosque</h3>
            
            {errorMsg && <p className="mb-4 text-sm font-semibold text-red-500">{errorMsg}</p>}
            {successMsg && <p className="mb-4 text-sm font-semibold text-green-500">{successMsg}</p>}

            <form onSubmit={handleRegisterMosque} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Mosque Name</label>
                <input
                  type="text"
                  placeholder="e.g. Masjid Al-Rahman"
                  value={newMosqueName}
                  onChange={(e) => {
                    setNewMosqueName(e.target.value);
                    // Autofill slug proposal
                    setNewMosqueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                  }}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">URL Slug</label>
                <input
                  type="text"
                  placeholder="e.g. al-rahman"
                  value={newMosqueSlug}
                  onChange={(e) => setNewMosqueSlug(e.target.value)}
                  className="input-field"
                  required
                />
                <span className="text-xs text-slate-400 block mt-1">
                  Your portal will be available at: /mosque/{newMosqueSlug || '[slug]'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Physical Address</label>
                <input
                  type="text"
                  placeholder="Street name, City"
                  value={newMosqueAddress}
                  onChange={(e) => setNewMosqueAddress(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Contact Email</label>
                <input
                  type="email"
                  placeholder="admin@mosque.org"
                  value={newMosqueEmail}
                  onChange={(e) => setNewMosqueEmail(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="eyebrow mb-3">First administrator</p>
                <div className="space-y-3">
                  <input type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Administrator full name" className="input-field" required />
                  <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Administrator sign-in email" className="input-field" required />
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Password (at least 8 characters)" minLength={8} className="input-field" required />
                </div>
              </div>
              
              <button type="submit" className="btn-primary w-full mt-2">
                Send application
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
