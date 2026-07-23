'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function MosqueLogin() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    // Mock Login Verification for Sprint 1 Demonstration
    if (email.includes('@') && password.length >= 6) {
      setSuccessMsg('Successfully authenticated!');
      setTimeout(() => {
        router.push(`/mosque/${slug}`);
      }, 1500);
    } else {
      setErrorMsg('Invalid email address or password must be at least 6 characters.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="card-premium max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link href={`/mosque/${slug}`} className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 hover:underline">
            ← Back to Mosque Portal
          </Link>
          <h2 className="text-3xl font-extrabold mt-4 text-slate-800 dark:text-white">Welcome Back</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Sign in to your member account</p>
        </div>

        {errorMsg && <p className="mb-4 text-sm font-semibold text-red-500 text-center">{errorMsg}</p>}
        {successMsg && <p className="mb-4 text-sm font-semibold text-green-500 text-center">{successMsg}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="••••••••"
              className="input-field"
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full mt-4">
            Sign In
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account?{' '}
          <Link href={`/mosque/${slug}/register`} className="text-emerald-600 dark:text-emerald-500 font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </main>
  );
}
