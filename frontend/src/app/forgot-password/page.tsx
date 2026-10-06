'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import BackButton from '@/components/BackButton';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setResetUrl('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your account email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api<{ success: boolean; message: string; resetToken?: string; resetUrl?: string }>(
        null,
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: trimmed })
        }
      );

      setMessage(res.message || 'Password reset link has been generated.');
      if (res.resetUrl) {
        setResetUrl(res.resetUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/login" />
          <Link href="/" className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
            ACCOUNT RECOVERY
          </span>
        </div>

        <Link
          href="/login"
          className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors"
        >
          SIGN IN &rarr;
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex items-center justify-center p-6 py-16 flex-grow">
        <div className="bg-white max-w-md w-full p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/30 shadow-2xl relative animate-fade-in space-y-6">
          <div className="text-center border-b border-[#c89b3c]/20 pb-4">
            <span className="w-12 h-12 rounded-full bg-[#e4efe9] text-[#0d4734] flex items-center justify-center mx-auto mb-3 font-black text-xl">
              🔑
            </span>
            <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
              IDENTITY RECOVERY
            </span>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#0d4734]">
              Forgot Password
            </h1>
            <p className="text-xs text-[#1c2421]/70 mt-2 font-normal leading-relaxed">
              Enter your registered email address. We will verify your account and provide secure instructions to set a new password.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[8px]">
              {error}
            </div>
          )}

          {message && (
            <div className="p-4 bg-[#e4efe9] border border-[#0d4734] text-[#0d4734] text-xs font-bold uppercase rounded-[8px] space-y-2">
              <p>{message}</p>
              {resetUrl && (
                <div className="pt-2">
                  <Link
                    href={resetUrl}
                    className="btn-pill-cta inline-block w-full py-2.5 px-4 text-[9px] tracking-widest text-center"
                  >
                    CONTINUE TO SET NEW PASSWORD →
                  </Link>
                </div>
              )}
            </div>
          )}

          {!resetUrl && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                  Registered Account Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="USER@EXAMPLE.COM"
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734] transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pill-cta w-full py-3.5 text-[10px] tracking-ultra-wide"
              >
                {isSubmitting ? 'GENERATING RESET LINK…' : 'REQUEST PASSWORD RESET →'}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-[#c89b3c]/20 flex justify-between items-center text-xs">
            <Link
              href="/login"
              className="text-[9px] font-black uppercase text-[#c89b3c] hover:text-[#0d4734] transition-colors tracking-wider"
            >
              &larr; Back to Sign In
            </Link>
            <Link
              href="/register"
              className="text-[9px] font-black uppercase text-[#0d4734] hover:text-[#c89b3c] transition-colors tracking-wider"
            >
              Create Account
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        <span suppressHydrationWarning> {new Date().getFullYear()}</span> MASJIDHUB MULTI-TENANT PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
