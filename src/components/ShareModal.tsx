'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  MessageSquare,
  FileDown,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Gift,
  Ticket,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Invoice, InvoiceItem, Voucher, Customer, FinalizeResult } from '@/types';
import { buildWhatsAppMessage, getWhatsAppUrl, getSmsUrl } from '@/lib/whatsapp';
import { downloadInvoicePdf, getInvoicePdfBlob } from '@/lib/pdf';
import { downloadVoucherPng, renderVoucherCanvas } from '@/lib/voucher-canvas';
import { DataService } from '@/lib/data-service';

interface ShareModalProps {
  finalizeResult: FinalizeResult;
  items: InvoiceItem[];
  customer?: Customer;
  onClose: () => void;
  onNewBill: () => void;
}

export function ShareModal({ finalizeResult, items, customer, onClose, onNewBill }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [markedSent, setMarkedSent] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isSharingFiles, setIsSharingFiles] = useState(false);

  const invoice: Invoice = {
    id: finalizeResult.invoice_id,
    invoice_number: finalizeResult.invoice_number,
    client_request_id: '',
    customer_id: finalizeResult.customer_id,
    subtotal: finalizeResult.subtotal,
    discount_total: finalizeResult.discount_total,
    voucher_total: finalizeResult.voucher_total,
    grand_total: finalizeResult.grand_total,
    payment_mode: 'UPI',
    status: 'FINALIZED',
    finalized_at: new Date().toISOString(),
  };

  const vouchers: Voucher[] = finalizeResult.vouchers.map((v, i) => ({
    id: `v-${i}`,
    code: v.code,
    source_invoice_id: finalizeResult.invoice_id,
    customer_id: finalizeResult.customer_id,
    face_value: v.face_value,
    min_purchase: v.min_purchase,
    status: 'ISSUED',
  }));

  // Build the WhatsApp formatted message
  const prefilledMessage = buildWhatsAppMessage({
    invoice,
    items,
    vouchers,
    gift: finalizeResult.gift ? { id: 'g', source_invoice_id: invoice.id, customer_id: invoice.customer_id, description: finalizeResult.gift.description, status: finalizeResult.gift.status as any } : null,
    giftClaimed: finalizeResult.gift?.claimed ?? true,
  });

  const customerPhone = customer?.phone_e164 || '';
  const whatsAppUrl = getWhatsAppUrl(customerPhone, prefilledMessage);
  const smsUrl = getSmsUrl(customerPhone, prefilledMessage);

  useEffect(() => {
    // Launch delightful confetti
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#e11d48', '#f43f5e', '#f59e0b', '#10b981'],
      });
    } catch {
      // safe fallback
    }

    // Log PREPARED message status (SHR-4)
    DataService.logMessage(finalizeResult.invoice_id, 'WHATSAPP', 'PREPARED').catch(console.error);
  }, [finalizeResult.invoice_id]);

  // Primary Action: Open WhatsApp (wa.me)
  const handleOpenWhatsApp = async () => {
    await DataService.logMessage(finalizeResult.invoice_id, 'WHATSAPP', 'OPENED');
    window.open(whatsAppUrl, '_blank');
  };

  // Secondary Action: Web Share API with PDF & Voucher PNG files
  const handleShareFiles = async () => {
    setIsSharingFiles(true);
    setShareStatus(null);
    try {
      const files: File[] = [];

      // 1. Generate PDF file
      const pdfBlob = getInvoicePdfBlob({ invoice, items, customer, vouchers, gift: null });
      const pdfFile = new File([pdfBlob], `Invoice_${invoice.invoice_number}.pdf`, {
        type: 'application/pdf',
      });
      files.push(pdfFile);

      // 2. Generate Voucher PNGs if any
      if (vouchers.length > 0) {
        for (let i = 0; i < vouchers.length; i++) {
          try {
            const pngBlob = await renderVoucherCanvas(vouchers[i]);
            const pngFile = new File([pngBlob], `Voucher_${vouchers[i].code}.png`, {
              type: 'image/png',
            });
            files.push(pngFile);
          } catch (e) {
            console.error('Voucher image generation skipped for file share', e);
          }
        }
      }

      // Check if navigator.canShare supports files
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          title: `FEVER Invoice ${invoice.invoice_number}`,
          text: `Your bill and reward vouchers from FEVER Trendy Collection!`,
          files,
        });
        setShareStatus('Files shared successfully via share sheet');
      } else {
        // Fallback to Download with clean instruction
        downloadInvoicePdf({ invoice, items, customer, vouchers, gift: null });
        if (vouchers.length > 0) {
          await downloadVoucherPng(vouchers[0]);
        }
        setShareStatus('Your browser does not support direct file sharing. Files downloaded to your device to attach manually.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setShareStatus('Notice: Use the Download buttons below to save files directly to your phone.');
      }
    } finally {
      setIsSharingFiles(false);
    }
  };

  // Fallback: Copy Message Text
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(prefilledMessage);
      setCopied(true);
      await DataService.logMessage(finalizeResult.invoice_id, 'COPY', 'OPENED');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  // Mark as Sent manually
  const handleMarkSent = async () => {
    await DataService.logMessage(finalizeResult.invoice_id, 'WHATSAPP', 'MARKED_SENT');
    setMarkedSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111726] border border-slate-700/80 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Bill Finalized</span>
                <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                  {finalizeResult.invoice_number}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Total: Rs {finalizeResult.grand_total}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Rewards Callout if earned */}
          {(finalizeResult.vouchers.length > 0 || finalizeResult.gift) && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 to-amber-950/20 border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Rewards Issued</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-200">
                {finalizeResult.vouchers.map((v) => (
                  <div key={v.code} className="flex items-center justify-between font-mono bg-black/30 px-2.5 py-1.5 rounded border border-rose-500/20">
                    <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                      <Ticket className="w-3.5 h-3.5" /> {v.code}
                    </span>
                    <span className="text-slate-300">Rs {v.face_value} OFF</span>
                  </div>
                ))}
                {finalizeResult.gift && (
                  <div className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded border border-amber-500/20">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Gift className="w-3.5 h-3.5" /> {finalizeResult.gift.description}
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {finalizeResult.gift.claimed ? '(Claimed)' : '(To collect)'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Share Action Buttons */}
          <div className="space-y-3">
            {/* 1. Primary Action: Send on WhatsApp */}
            <button
              onClick={handleOpenWhatsApp}
              className="w-full h-13 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-emerald-950/60 transition-all touch-target"
            >
              <MessageSquare className="w-5 h-5 fill-current" />
              <span>Send on WhatsApp</span>
              <ExternalLink className="w-4 h-4 opacity-70" />
            </button>
            <p className="text-[11px] text-center text-slate-400">
              Opens WhatsApp chat with prefilled itemized invoice and reward codes
            </p>

            {/* 2. Secondary Action: Share Files (Web Share API) */}
            <button
              onClick={handleShareFiles}
              disabled={isSharingFiles}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-slate-200 font-medium text-sm flex items-center justify-center gap-2 border border-slate-700 transition-all touch-target"
            >
              <Share2 className="w-4 h-4 text-rose-400" />
              <span>{isSharingFiles ? 'Preparing Files...' : 'Share PDF & Voucher Images'}</span>
            </button>

            {shareStatus && (
              <p className="text-xs text-amber-300 bg-amber-950/30 p-2.5 rounded-lg border border-amber-800/40">
                {shareStatus}
              </p>
            )}

            {/* 3. Fallbacks: Copy & SMS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleCopyMessage}
                className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-800 transition-colors touch-target"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Message'}</span>
              </button>

              <a
                href={smsUrl}
                className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-800 transition-colors touch-target text-center"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Send via SMS</span>
              </a>
            </div>
          </div>

          {/* Direct File Downloads */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Save Files Directly
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => downloadInvoicePdf({ invoice, items, customer, vouchers, gift: null })}
                className="py-2 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs flex items-center justify-center gap-1.5 border border-slate-800 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Download PDF</span>
              </button>

              {vouchers.length > 0 ? (
                <button
                  onClick={() => downloadVoucherPng(vouchers[0])}
                  className="py-2 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs flex items-center justify-center gap-1.5 border border-slate-800 transition-colors"
                >
                  <Ticket className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download Voucher PNG</span>
                </button>
              ) : (
                <div className="py-2 px-3 rounded-lg bg-slate-900/40 text-slate-500 text-xs flex items-center justify-center border border-slate-800/40">
                  No vouchers on bill
                </div>
              )}
            </div>
          </div>

          {/* Logging status */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
            <span>Status: Prepared</span>
            <button
              onClick={handleMarkSent}
              disabled={markedSent}
              className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                markedSent
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              {markedSent ? '✓ Marked as Sent' : 'Mark as Sent'}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
          <button
            onClick={onNewBill}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/60 transition-all touch-target"
          >
            Start New Bill
          </button>
        </div>
      </div>
    </div>
  );
}
