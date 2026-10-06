'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import BackButton from '@/components/BackButton';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [resetToken, setResetToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!resetToken.trim()) {
      setError('Please provide a valid password reset token.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api<{ success: boolean; message: string }>(null, '/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken: resetToken.trim(),
          newPassword
        })
      });

      setMessage(res.message || 'Password successfully updated!');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white max-w-md w-full p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/30 shadow-2xl relative animate-fade-in space-y-6">
      <div className="text-center border-b border-[#c89b3c]/20 pb-4">
        <span className="w-12 h-12 rounded-full bg-[#e4efe9] text-[#0d4734] flex items-center justify-center mx-auto mb-3 font-black text-xl">
          🔒
        </span>
        <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
          CREDENTIALS UPDATE
        </span>
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#0d4734]">
          Set New Password
        </h1>
        <p className="text-xs text-[#1c2421]/70 mt-2 font-normal leading-relaxed">
          Create a secure, fresh password with at least 8 characters.
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
          <p className="text-[10px] font-mono text-[#0d4734]/70">Redirecting to Sign In in a moment…</p>
        </div>
      )}

      {!message && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
              Reset Token *
            </label>
            <input
              type="text"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="PASTE RECOVERY TOKEN"
              className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2 px-3 text-xs font-mono text-[#1c2421] focus:outline-none focus:border-[#0d4734] transition-colors"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60">
                New Password (Min 8 Chars) *
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[9px] font-bold uppercase text-[#c89b3c] hover:text-[#0d4734] transition-colors"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734] transition-colors"
              required
            />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
              Confirm New Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[8px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734] transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-pill-cta w-full py-3.5 text-[10px] tracking-ultra-wide"
          >
            {isSubmitting ? 'UPDATING CREDENTIALS…' : 'CONFIRM & UPDATE PASSWORD →'}
          </button>
        </form>
      )}

      <div className="pt-4 border-t border-[#c89b3c]/20 flex justify-between items-center text-xs">
        <Link
          href="/forgot-password"
          className="text-[9px] font-black uppercase text-[#c89b3c] hover:text-[#0d4734] transition-colors tracking-wider"
        >
          &larr; Request New Link
        </Link>
        <Link
          href="/login"
          className="text-[9px] font-black uppercase text-[#0d4734] hover:text-[#c89b3c] transition-colors tracking-wider"
        >
          Sign In &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
            PASSWORD RESET
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
        <Suspense fallback={<div className="p-8 text-center text-xs font-bold uppercase text-[#0d4734]">Loading recovery session…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        <span suppressHydrationWarning> {new Date().getFullYear()}</span> MASJIDHUB MULTI-TENANT PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
