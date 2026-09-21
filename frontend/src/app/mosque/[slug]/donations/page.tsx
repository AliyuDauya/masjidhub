'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

// Helper to reliably load Paystack Inline JS
function loadPaystackScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).PaystackPop) return resolve(true);

    const existingScript = document.getElementById('paystack-inline-js');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'paystack-inline-js';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function MosqueDonations() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const mosqueName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Form State
  const [amount, setAmount] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorName, setDonorName] = useState('');
  const [category, setCategory] = useState<'Zakat' | 'Sadaqah' | 'Waqf' | 'General'>('Sadaqah');
  const [method, setMethod] = useState<'Paystack' | 'Transfer'>('Paystack');
  const [transferRef, setTransferRef] = useState('');

  // Status & Receipt State
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState<{
    receiptId: string;
    amount: number;
    category: string;
    method: string;
    date: string;
    paystackRef?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-load Paystack script on page mount
  useEffect(() => {
    loadPaystackScript().catch(() => {});
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMessage('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid contribution amount greater than 0.');
      return;
    }

    const emailToUse = donorEmail.trim();
    if (!emailToUse || !emailToUse.includes('@')) {
      setErrorMsg('Please enter a valid donor email address for your payment receipt.');
      return;
    }

    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

    // Handle Paystack Card / Online Payment
    if (method === 'Paystack') {
      setIsProcessing(true);
      setStatusMessage('Initializing secure Paystack gateway…');

      const isScriptLoaded = await loadPaystackScript();
      const PaystackPopGlobal = (window as any).PaystackPop;

      if (!isScriptLoaded || !PaystackPopGlobal) {
        setIsProcessing(false);
        setStatusMessage('');
        setErrorMsg('Unable to load Paystack payment module. Please check your internet connection.');
        return;
      }

      if (!paystackPublicKey) {
        setIsProcessing(false);
        setStatusMessage('');
        setErrorMsg('Paystack Public Key is not configured. Please ensure NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is set in .env.local.');
        return;
      }

      const txRef = `MH-${slug}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      // Dedicated success and close handlers
      const onPaymentSuccess = (response: any) => {
        const reference = response?.reference || response?.trxref || txRef;
        setStatusMessage('Verifying payment with Paystack & generating receipt…');

        api<{
          receipt_number: string;
          amount: number;
          category: string;
          method: string;
          date: string;
          external_reference?: string;
        }>(slug, '/api/donations/paystack/verify', {
          method: 'POST',
          body: JSON.stringify({
            reference: reference,
            category,
          }),
        })
          .then((receipt) => {
            setIsProcessing(false);
            setStatusMessage('');
            setReceiptDetails({
              receiptId: receipt.receipt_number,
              amount: receipt.amount,
              category: receipt.category,
              method: 'Paystack Secured (Card / Bank / USSD)',
              date: new Date(receipt.date).toLocaleString(),
              paystackRef: reference,
            });
            setShowReceipt(true);
            setAmount('');
            setTransferRef('');
          })
          .catch((verifError) => {
            setIsProcessing(false);
            setStatusMessage('');
            setErrorMsg(
              verifError instanceof Error
                ? verifError.message
                : 'Payment was made on Paystack but verification failed. Reference: ' + reference
            );
          });
      };

      const onPaymentClose = () => {
        setIsProcessing(false);
        setStatusMessage('');
      };

      try {
        if (typeof PaystackPopGlobal.setup === 'function') {
          // Paystack Inline v1 API
          const handler = PaystackPopGlobal.setup({
            key: paystackPublicKey,
            email: emailToUse,
            amount: Math.round(parsedAmount * 100), // Kobo conversion
            currency: 'NGN',
            ref: txRef,
            metadata: {
              mosque_slug: slug,
              mosque_name: mosqueName,
              category: category,
              donor_name: donorName.trim() || undefined,
            },
            callback: function (response: any) {
              onPaymentSuccess(response);
            },
            onClose: function () {
              onPaymentClose();
            },
          });
          handler.openIframe();
        } else if (typeof PaystackPopGlobal === 'function') {
          // Paystack Inline v2 API
          const popup = new PaystackPopGlobal();
          popup.newTransaction({
            key: paystackPublicKey,
            email: emailToUse,
            amount: Math.round(parsedAmount * 100),
            currency: 'NGN',
            ref: txRef,
            onSuccess: function (transaction: any) {
              onPaymentSuccess(transaction);
            },
            onCancel: function () {
              onPaymentClose();
            },
          });
        }
      } catch (launchErr) {
        setIsProcessing(false);
        setStatusMessage('');
        setErrorMsg(launchErr instanceof Error ? launchErr.message : 'Could not launch Paystack checkout.');
      }
      return;
    }


    // Handle Direct Bank Transfer Recording
    if (method === 'Transfer') {
      setIsProcessing(true);
      setStatusMessage('Recording direct bank transfer reference…');

      try {
        const receipt = await api<{
          receipt_number: string;
          amount: number;
          category: string;
          method: string;
          date: string;
        }>(slug, '/api/donations', {
          method: 'POST',
          body: JSON.stringify({
            amount: parsedAmount,
            category,
            method: 'Transfer',
            currency: 'NGN',
            external_reference: transferRef.trim() || undefined,
            donor_email: emailToUse,
          }),
        });

        setIsProcessing(false);
        setStatusMessage('');
        setReceiptDetails({
          receiptId: receipt.receipt_number,
          amount: receipt.amount,
          category: receipt.category,
          method: 'Direct Bank Transfer',
          date: new Date(receipt.date).toLocaleString(),
          paystackRef: transferRef.trim() || undefined,
        });
        setShowReceipt(true);
        setAmount('');
        setTransferRef('');
      } catch (err) {
        setIsProcessing(false);
        setStatusMessage('');
        setErrorMsg(err instanceof Error ? err.message : 'Direct transfer donation could not be recorded.');
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* Paystack Inline Script */}
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />

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
            Direct, transparent contributions with automated cryptographically verifiable tax receipts via Paystack.
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

              {/* Paystack Trust Badge */}
              <div className="pt-4 border-t border-[#c89b3c]/15 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d4734]">
                    Paystack Payment Gateway Active
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[#1c2421]/50 uppercase">
                  256-Bit SSL Encrypted
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Donation Form / Receipt Card */}
          <div className="lg:col-span-6">
            {!showReceipt ? (
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c]/30 shadow-2xl relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                    SECURE CHECKOUT
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0d4734]/10 text-[#0d4734]">
                    ₦ NGN / Naira
                  </span>
                </div>

                <h2 className="text-3xl font-black uppercase tracking-tighter text-[#0d4734] mb-6">
                  SUBMIT CONTRIBUTION
                </h2>

                {errorMsg && (
                  <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
                    {errorMsg}
                  </div>
                )}

                {statusMessage && (
                  <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase rounded-[6px] animate-pulse">
                    {statusMessage}
                  </div>
                )}

                <form onSubmit={handleCheckout} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Donation Amount (NGN / ₦) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-0 top-3 text-lg font-black text-[#0d4734]">₦</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="10000"
                        className="w-full bg-transparent border-b border-[#c89b3c]/30 pl-6 py-3 text-lg font-black text-[#0d4734] tracking-wider focus:outline-none focus:border-[#c89b3c]"
                        required
                        min="100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                        Donor Email Address *
                      </label>
                      <input
                        type="email"
                        value={donorEmail}
                        onChange={(e) => setDonorEmail(e.target.value)}
                        placeholder="donor@example.org"
                        className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 py-3 px-3 text-xs font-bold tracking-wider text-[#1c2421] rounded-[6px] focus:outline-none focus:border-[#0d4734]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                        Donor Full Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        placeholder="E.g. Fatima Ali"
                        className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 py-3 px-3 text-xs font-bold tracking-wider text-[#1c2421] rounded-[6px] focus:outline-none focus:border-[#0d4734]"
                      />
                    </div>
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
                        onClick={() => setMethod('Paystack')}
                        className={`py-3 px-4 rounded-[6px] text-xs font-bold uppercase tracking-wider border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          method === 'Paystack'
                            ? 'bg-[#0d4734] text-white border-[#0d4734] shadow-xs'
                            : 'bg-[#f6f3eb] text-[#1c2421] border-[#c89b3c]/30 hover:border-[#0d4734]'
                        }`}
                      >
                        <span>Card / Paystack</span>
                        <span className="text-[8px] opacity-80 lowercase font-normal">Card, Bank, USSD, Apple Pay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod('Transfer')}
                        className={`py-3 px-4 rounded-[6px] text-xs font-bold uppercase tracking-wider border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          method === 'Transfer'
                            ? 'bg-[#0d4734] text-white border-[#0d4734] shadow-xs'
                            : 'bg-[#f6f3eb] text-[#1c2421] border-[#c89b3c]/30 hover:border-[#0d4734]'
                        }`}
                      >
                        <span>Direct Transfer</span>
                        <span className="text-[8px] opacity-80 lowercase font-normal">Manual Bank Wire</span>
                      </button>
                    </div>
                  </div>

                  {method === 'Transfer' && (
                    <div className="p-4 bg-[#f6f3eb] rounded-[8px] border border-[#c89b3c]/30 space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] block">
                        Bank Transfer Reference
                      </span>
                      <input
                        type="text"
                        value={transferRef}
                        onChange={(e) => setTransferRef(e.target.value)}
                        placeholder="Enter Bank Session ID / Ref Number"
                        className="w-full bg-white border border-[#c89b3c]/30 py-2 px-3 text-xs font-mono rounded-[4px] focus:outline-none focus:border-[#0d4734]"
                      />
                      <p className="text-[10px] text-[#1c2421]/60">
                        Please make your payment to {mosqueName} bank account and enter your transfer reference above.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="btn-pill-cta w-full py-4 tracking-ultra-wide mt-4 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <span>{statusMessage || 'PROCESSING PAYMENT…'}</span>
                    ) : method === 'Paystack' ? (
                      <span>PAY WITH PAYSTACK {amount ? `(₦${Number(amount).toLocaleString()})` : ''} →</span>
                    ) : (
                      <span>RECORD BANK TRANSFER RECEIPT →</span>
                    )}
                  </button>

                  <div className="text-center">
                    <span className="text-[9px] text-[#1c2421]/50 uppercase tracking-wider">
                      🔒 Transactions secured by Paystack with instant receipt generation
                    </span>
                  </div>
                </form>
              </div>
            ) : (
              /* Receipt Modal / View */
              <div className="bg-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c] shadow-2xl relative animate-fade-in space-y-6">
                <div className="text-center border-b border-[#c89b3c]/20 pb-6">
                  <span className="w-12 h-12 rounded-full bg-[#e4efe9] text-[#0d4734] flex items-center justify-center mx-auto mb-3 font-black text-xl">
                    ✓
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    VERIFIED CONTRIBUTION
                  </span>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-[#0d4734]">
                    OFFICIAL TAX RECEIPT
                  </h2>
                </div>

                <div className="space-y-3 font-mono text-xs text-[#1c2421]/80">
                  <div className="flex justify-between py-2 border-b border-[#c89b3c]/15">
                    <span className="text-[#1c2421]/50 uppercase">Receipt Number:</span>
                    <span className="font-bold text-[#0d4734]">{receiptDetails?.receiptId}</span>
                  </div>
                  {receiptDetails?.paystackRef && (
                    <div className="flex justify-between py-2 border-b border-[#c89b3c]/15">
                      <span className="text-[#1c2421]/50 uppercase">Paystack Reference:</span>
                      <span className="font-bold text-[#0d4734] text-[11px] truncate max-w-[200px]">
                        {receiptDetails?.paystackRef}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-[#c89b3c]/15">
                    <span className="text-[#1c2421]/50 uppercase">Amount:</span>
                    <span className="font-bold text-[#0d4734] text-sm">
                      ₦{receiptDetails?.amount?.toLocaleString()}
                    </span>
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
