'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function MosqueDonations() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  // Capitalize name for visual aesthetics
  const mosqueName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ' Donation Portal';

  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'Zakat' | 'Sadaqah' | 'Waqf' | 'General'>('Sadaqah');
  const [method, setMethod] = useState<'Card' | 'Transfer'>('Card');
  
  // Checkout Modal Simulation
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid donation amount greater than 0.');
      return;
    }

    setIsProcessing(true);

    try {
      const receipt = await api<any>(slug, '/api/donations', { method: 'POST', body: JSON.stringify({ amount: parsedAmount, category, method, currency: 'NGN' }) });
      setIsProcessing(false);
      setReceiptDetails({
        receiptId: receipt.receipt_number,
        amount: receipt.amount,
        category: receipt.category,
        method: receipt.method,
        date: new Date(receipt.date).toLocaleString()
      });
      setShowReceipt(true);
      setAmount('');
    } catch (error) { setIsProcessing(false); setErrorMsg(error instanceof Error ? error.message : 'Donation could not be recorded.'); }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6 flex justify-between items-center shadow-sm">
        <Link href={`/mosque/${slug}`} className="text-xl font-extrabold text-emerald-600 dark:text-emerald-500">
          MasjidHub
        </Link>
        <Link href={`/mosque/${slug}`} className="btn-secondary px-4 py-2 text-sm">
          ← Back to Portal
        </Link>
      </header>

      {/* Donation Form and Receipt display */}
      <div className="max-w-4xl mx-auto px-6 py-12 flex-grow w-full grid md:grid-cols-2 gap-8 items-start">
        
        {/* Left Card: Information details about Zakat & Sadaqah */}
        <section className="space-y-6">
          <div className="card-premium">
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-4">Supporting Your Mosque</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Your financial contributions help sustain operations, manage religious education, and support families in need within the local community.
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Zakat</h4>
                <p className="text-xs text-slate-500 mt-0.5">Obligatory annual charity allocated directly to the eligible categories in the community.</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Sadaqah</h4>
                <p className="text-xs text-slate-500 mt-0.5">Voluntary charitable offerings to support various local development programs.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Card: Dynamic payment portal checkout */}
        <section>
          {!showReceipt ? (
            <div className="card-premium">
              <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">{mosqueName}</h3>
              {errorMsg && <p className="mb-4 text-sm font-semibold text-red-500">{errorMsg}</p>}

              <form onSubmit={handleCheckout} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Donation Amount ($)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Contribution Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="Sadaqah">Sadaqah (Voluntary Charity)</option>
                    <option value="Zakat">Zakat (Alms-giving)</option>
                    <option value="Waqf">Waqf (Endowment Trust)</option>
                    <option value="General">General Mosque Operations</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Payment Gateway</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setMethod('Card')}
                      className={`py-2 text-center text-sm font-bold border rounded-lg transition-all ${
                        method === 'Card'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      💳 Credit/Debit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod('Transfer')}
                      className={`py-2 text-center text-sm font-bold border rounded-lg transition-all ${
                        method === 'Transfer'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      🏦 Bank Transfer
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="btn-primary w-full mt-4"
                >
                  {isProcessing ? 'Processing Transaction...' : 'Proceed to Checkout'}
                </button>
              </form>
            </div>
          ) : (
            /* Printable Receipt view */
            <div className="card-premium border-t-8 border-t-emerald-600 animate-fade-in">
              <div className="text-center mb-6">
                <span className="text-4xl">✅</span>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-2">Donation Completed</h3>
                <p className="text-xs text-slate-400 mt-1">Thank you for your support!</p>
              </div>

              <div className="border-t border-b border-slate-100 dark:border-slate-800 py-4 my-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Receipt ID:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{receiptDetails.receiptId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-slate-800 dark:text-white">${receiptDetails.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{receiptDetails.category}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="text-slate-700 dark:text-slate-300">{receiptDetails.method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Transaction Date:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{receiptDetails.date}</span>
                </div>
              </div>

              <button
                onClick={() => setShowReceipt(false)}
                className="btn-primary w-full"
              >
                Make Another Donation
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} {mosqueName}. Powered by MasjidHub.</p>
      </footer>
    </main>
  );
}
