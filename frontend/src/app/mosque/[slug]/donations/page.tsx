'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function MosqueDonations() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const mosqueName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'Zakat' | 'Sadaqah' | 'Waqf' | 'General'>('Sadaqah');
  const [method, setMethod] = useState<'Card' | 'Transfer'>('Card');
  
  // Checkout Modal Simulation
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState<{
    receiptId: string;
    amount: number;
    category: string;
    method: string;
    date: string;
  } | null>(null);
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
      const receipt = await api<{
        receipt_number: string;
        amount: number;
        category: string;
        method: string;
        date: string;
      }>(slug, '/api/donations', {
        method: 'POST',
        body: JSON.stringify({ amount: parsedAmount, category, method, currency: 'NGN' }),
      });
      setIsProcessing(false);
      setReceiptDetails({
        receiptId: receipt.receipt_number,
        amount: receipt.amount,
        category: receipt.category,
        method: receipt.method,
        date: new Date(receipt.date).toLocaleString(),
      });
      setShowReceipt(true);
      setAmount('');
    } catch (error) {
      setIsProcessing(false);
      setErrorMsg(error instanceof Error ? error.message : 'Donation could not be recorded.');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between">
        <Link href={`/mosque/${slug}`} className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
          <span>MASJIDHUB</span>
        </Link>
        <Link href={`/mosque/${slug}`} className="text-[10px] font-black uppercase tracking-ultra-wide text-[#0d4734] hover:text-[#c89b3c] transition-colors">
          &larr; RETURN TO PORTAL
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-16 flex-grow w-full">
        <div className="mb-12">
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
            01 / STEWARDSHIP & GIVING LEDGER
          </span>
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter text-[#0d4734]">
            {mosqueName} <span className="italic font-light lowercase text-[#c89b3c]">giving</span>
          </h1>
          <p className="text-sm md:text-base text-[#1c2421]/70 max-w-2xl mt-2 font-normal">
            Direct, transparent contributions with automated cryptographically verifiable tax receipts.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Categorization Guides */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/20 shadow-xs space-y-6">
              <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                Allocations & Impact
              </h2>
              <p className="text-xs sm:text-sm text-[#1c2421]/70 leading-relaxed font-normal">
                Your contributions directly fund localized religious education, maintenance of the sanctuary, and designated welfare distributions.
              </p>

              <div className="space-y-4 pt-2">
                <div className="p-5 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black text-xs uppercase tracking-wider text-[#0d4734]">Zakat (Alms)</h3>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#c89b3c]">Obligatory</span>
                  </div>
                  <p className="text-xs text-[#1c2421]/70 font-normal leading-relaxed">
                    Strictly audited and disbursed exclusively to verified beneficiaries under Islamic guidelines.
                  </p>
                </div>

                <div className="p-5 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black text-xs uppercase tracking-wider text-[#0d4734]">Sadaqah (Charity)</h3>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734]">Voluntary</span>
                  </div>
                  <p className="text-xs text-[#1c2421]/70 font-normal leading-relaxed">
                    General benevolent funding for community hardship relief, food pantries, and youth programmes.
                  </p>
                </div>

                <div className="p-5 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/20">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black text-xs uppercase tracking-wider text-[#0d4734]">Waqf & Operations</h3>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#c89b3c]">Endowment</span>
                  </div>
                  <p className="text-xs text-[#1c2421]/70 font-normal leading-relaxed">
                    Long-term institutional capital for building maintenance, utility reserves, and property expansion.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Donation Form / Receipt Card */}
          <div className="lg:col-span-6">
            {!showReceipt ? (
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/30 shadow-2xl relative">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
                  SECURE CHECKOUT
                </span>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-[#0d4734] mb-6">
                  SUBMIT CONTRIBUTION
                </h2>

                {errorMsg && (
                  <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleCheckout} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Donation Amount (NGN / ₦)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="E.G. 10000"
                      className="w-full bg-transparent border-b border-[#c89b3c]/30 py-3 text-lg font-black text-[#0d4734] tracking-wider focus:outline-none focus:border-[#c89b3c]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Contribution Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 py-3 px-3 text-xs font-bold uppercase tracking-wider text-[#1c2421] rounded-[6px] focus:outline-none focus:border-[#0d4734]"
                    >
                      <option value="Sadaqah">Sadaqah (Voluntary Charity)</option>
                      <option value="Zakat">Zakat (Obligatory Alms)</option>
                      <option value="Waqf">Waqf (Endowment Trust)</option>
                      <option value="General">General Mosque Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Payment Channel
                    </label>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <button
                        type="button"
                        onClick={() => setMethod('Card')}
                        className={`py-3 px-4 rounded-[6px] text-xs font-bold uppercase tracking-wider border text-center transition-all ${
                          method === 'Card'
                            ? 'bg-[#0d4734] text-white border-[#0d4734] shadow-xs'
                            : 'bg-[#f6f3eb] text-[#1c2421] border-[#c89b3c]/30 hover:border-[#0d4734]'
                        }`}
                      >
                        Debit / Credit Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod('Transfer')}
                        className={`py-3 px-4 rounded-[6px] text-xs font-bold uppercase tracking-wider border text-center transition-all ${
                          method === 'Transfer'
                            ? 'bg-[#0d4734] text-white border-[#0d4734] shadow-xs'
                            : 'bg-[#f6f3eb] text-[#1c2421] border-[#c89b3c]/30 hover:border-[#0d4734]'
                        }`}
                      >
                        Direct Transfer
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="btn-pill-cta w-full py-4 tracking-ultra-wide mt-4"
                  >
                    {isProcessing ? 'RECORDING LEDGER DISPATCH…' : 'CONFIRM & RECEIPT DONATION →'}
                  </button>
                </form>
              </div>
            ) : (
              /* Receipt Modal / View */
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c] shadow-2xl relative animate-fade-in space-y-6">
                <div className="text-center border-b border-[#c89b3c]/20 pb-6">
                  <span className="w-10 h-10 rounded-full bg-[#e4efe9] text-[#0d4734] flex items-center justify-center mx-auto mb-3 font-black text-lg">
                    ✓
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    VERIFIED CONTRIBUTION
                  </span>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-[#0d4734]">
                    OFFICIAL RECEIPT
                  </h2>
                </div>

                <div className="space-y-3 font-mono text-xs text-[#1c2421]/80">
                  <div className="flex justify-between py-2 border-b border-[#c89b3c]/15">
                    <span className="text-[#1c2421]/50 uppercase">Receipt Reference:</span>
                    <span className="font-bold text-[#0d4734]">{receiptDetails?.receiptId}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#c89b3c]/15">
                    <span className="text-[#1c2421]/50 uppercase">Amount:</span>
                    <span className="font-bold text-[#0d4734]">₦{receiptDetails?.amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#c89b3c]/15">
                    <span className="text-[#1c2421]/50 uppercase">Category:</span>
                    <span className="font-bold">{receiptDetails?.category}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#c89b3c]/15">
                    <span className="text-[#1c2421]/50 uppercase">Payment Channel:</span>
                    <span className="font-bold">{receiptDetails?.method}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[#1c2421]/50 uppercase">Timestamp:</span>
                    <span className="font-bold">{receiptDetails?.date}</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowReceipt(false)}
                    className="btn-pill-cta flex-1 py-3 text-[9px] tracking-ultra-wide text-center"
                  >
                    DONATE AGAIN
                  </button>
                  <Link
                    href={`/mosque/${slug}`}
                    className="btn-pill-secondary flex-1 py-3 text-[9px] tracking-ultra-wide text-center"
                  >
                    BACK TO PORTAL
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
