'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function MosqueRegister() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name || !email || !password || !role) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    // Mock Registration Flow for Sprint 1 Demonstration
    setSuccessMsg('Account created successfully! Redirecting...');
    setTimeout(() => {
      router.push(`/mosque/${slug}/login`);
    }, 1500);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="card-premium max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link href={`/mosque/${slug}`} className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 hover:underline">
            ← Back to Mosque Portal
          </Link>
          <h2 className="text-3xl font-extrabold mt-4 text-slate-800 dark:text-white">Create Account</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Join your local mosque community</p>
        </div>

        {errorMsg && <p className="mb-4 text-sm font-semibold text-red-500 text-center">{errorMsg}</p>}
        {successMsg && <p className="mb-4 text-sm font-semibold text-green-500 text-center">{successMsg}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahmad Ali"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="•••••••• (Min 6 characters)"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Phone Number (Optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234..."
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">I am joining as a:</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
              className="input-field"
            >
              <option value="member">Regular Mosque Member</option>
              <option value="admin">Mosque Administrator</option>
            </select>
          </div>

          <button type="submit" className="btn-primary w-full mt-4">
            Register Account
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link href={`/mosque/${slug}/login`} className="text-emerald-600 dark:text-emerald-500 font-semibold hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </main>
  );
}
