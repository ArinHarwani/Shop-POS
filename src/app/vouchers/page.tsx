'use client';

import React, { useState } from 'react';
import {
  Ticket,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Voucher, Invoice, Customer } from '@/types';
import { DataService } from '@/lib/data-service';
import { formatDisplayDate } from '@/lib/whatsapp';

export default function VouchersPage() {
  const [searchCode, setSearchCode] = useState('');
  const [lookupResult, setLookupResult] = useState<{
    voucher: Voucher;
    invoice?: Invoice;
    customer?: Customer;
  } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLookupError(null);
    setRedeemSuccess(null);
    setLookupResult(null);

    const clean = searchCode.trim().toUpperCase();
    if (!clean) {
      setLookupError('Please enter a voucher code (e.g. TRD-K7M2-9QXA)');
      return;
    }

    try {
      const res = await DataService.lookupVoucher(clean);
      if (!res) {
        setLookupError(`No voucher found with code "${clean}". Please verify spelling.`);
      } else {
        setLookupResult(res);
      }
    } catch (err: any) {
      setLookupError(err.message || 'Error looking up voucher.');
    }
  };

  const handleConfirmRedeem = async () => {
    if (!lookupResult) return;
    setIsRedeeming(true);
    setLookupError(null);
    setRedeemSuccess(null);

    try {
      const updated = await DataService.redeemVoucher(lookupResult.voucher.code);
      setRedeemSuccess(`Voucher ${updated.code} successfully marked REDEEMED!`);
      // Update local state
      setLookupResult({
        ...lookupResult,
        voucher: updated,
      });
    } catch (err: any) {
      setLookupError(err.message || 'Redemption refused by server.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const getStatusBadge = (status: Voucher['status']) => {
    switch (status) {
      case 'ISSUED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="w-4 h-4" /> Valid (Ready to Redeem)
          </span>
        );
      case 'REDEEMED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-950/60 text-blue-400 border border-blue-500/40">
            <CheckCircle2 className="w-4 h-4" /> Already Redeemed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950/60 text-rose-400 border border-rose-500/40">
            <XCircle className="w-4 h-4" /> Cancelled (Bill Voided)
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/60 text-amber-400 border border-amber-500/40">
            <Clock className="w-4 h-4" /> Expired
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full flex-1 flex flex-col space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          <Ticket className="w-6 h-6 text-amber-400" />
          <span>Voucher Verification & Redemption</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Store staff lookup terminal: verify customer voucher codes, inspect eligibility, and redeem server-side.
        </p>
      </div>

      {/* Code Search Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              placeholder="Enter Voucher Code (e.g. TRD-XXXX-XXXX)"
              className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm uppercase placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 touch-target"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-950/40 transition-all touch-target flex items-center justify-center gap-2"
          >
            <span>Verify Code</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {lookupError && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{lookupError}</span>
          </div>
        )}

        {redeemSuccess && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{redeemSuccess}</span>
          </div>
        )}
      </div>

      {/* Lookup Result Card */}
      {lookupResult && (
        <div className="bg-gradient-to-br from-[#121929] via-[#0f1422] to-[#090d16] border border-slate-700/80 rounded-2xl p-6 space-y-6 shadow-2xl animate-in fade-in">
          {/* Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                FEVER Reward Voucher
              </span>
              <div className="font-mono font-black text-2xl text-amber-300 tracking-wider">
                {lookupResult.voucher.code}
              </div>
            </div>
            <div>{getStatusBadge(lookupResult.voucher.status)}</div>
          </div>

          {/* Value & Terms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-black/30 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Face Value</span>
              <span className="text-2xl font-black text-white font-mono">
                Rs {lookupResult.voucher.face_value} OFF
              </span>
            </div>

            <div className="bg-black/30 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Min Purchase</span>
              <span className="text-lg font-bold text-slate-200">
                {lookupResult.voucher.min_purchase
                  ? `Rs ${lookupResult.voucher.min_purchase}+`
                  : 'No minimum'}
              </span>
            </div>

            <div className="bg-black/30 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Where & Expiry</span>
              <span className="text-xs font-medium text-slate-300 block">Store only</span>
              <span className="text-xs text-slate-400">
                {lookupResult.voucher.expires_at
                  ? `Valid till ${formatDisplayDate(lookupResult.voucher.expires_at)}`
                  : 'Valid at Jodhpur store'}
              </span>
            </div>
          </div>

          {/* Source Invoice & Customer Details */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              Origin Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div>
                <span className="text-slate-500">Source Invoice: </span>
                <span className="font-mono font-bold text-white">
                  {lookupResult.invoice ? lookupResult.invoice.invoice_number : '—'}
                </span>
                {lookupResult.invoice && (
                  <span className="text-slate-500 text-[11px]">
                    {' '}
                    ({formatDisplayDate(lookupResult.invoice.finalized_at)})
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500">Customer: </span>
                <span className="font-medium text-white">
                  {lookupResult.customer?.name || 'Shopper'} (
                  {lookupResult.customer?.phone_e164 || '—'})
                </span>
              </div>
            </div>
            {lookupResult.voucher.redeemed_at && (
              <div className="pt-2 border-t border-slate-800 text-blue-300 text-[11px]">
                Redeemed on: {formatDisplayDate(lookupResult.voucher.redeemed_at)}
              </div>
            )}
          </div>

          {/* Action Button: Redeem Voucher */}
          {lookupResult.voucher.status === 'ISSUED' && (
            <div className="pt-2">
              <button
                onClick={handleConfirmRedeem}
                disabled={isRedeeming}
                className="w-full h-13 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all touch-target"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>
                  {isRedeeming ? 'Validating on Server...' : 'Confirm In-Store Redemption (1-Use)'}
                </span>
              </button>
              <p className="text-[11px] text-center text-slate-500 mt-2">
                This locks the voucher immediately in the database and prevents duplicate redemptions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
