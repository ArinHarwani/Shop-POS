'use client';

import React, { useState } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { FIXTURE_TODAY_BILLS, FixtureBill } from '@/lib/fixtures';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { buildWhatsAppMessage, getWhatsAppUrl, getSmsUrl } from '@/lib/whatsapp';
import { downloadInvoicePdf } from '@/lib/pdf';

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<FixtureBill | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredBills = FIXTURE_TODAY_BILLS.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.bill_number.toLowerCase().includes(q) ||
      b.customer_phone.includes(q) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full flex-1 flex justify-center bg-white">
      <div className="w-full max-w-[520px] flex flex-col min-h-[calc(100vh-64px)] px-4 py-4 sm:py-6">
        {selectedBill ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E6]">
                <h1 className="text-[20px] font-bold text-[#1A1A1A]">
                  Bill {selectedBill.bill_number}
                </h1>
                <button
                  type="button"
                  onClick={() => setSelectedBill(null)}
                  className="text-[15px] font-medium text-[#6B6B6B] hover:text-[#1A1A1A]"
                >
                  {STRINGS.backBtn}
                </button>
              </div>

              {/* Calm Summary */}
              <div className="bg-[#F6F6F4] p-4 rounded-[8px] border border-[#E6E6E6] flex flex-col gap-2.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">Time:</span>
                  <span className="font-semibold text-[#1A1A1A] text-[17px]">{selectedBill.time}</span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">Customer:</span>
                  <span className="font-semibold text-[#1A1A1A] text-[17px]">
                    {selectedBill.customer_name || 'Shopper'} ({selectedBill.customer_phone})
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">Garments:</span>
                  <span className="font-semibold text-[#1A1A1A] text-[17px]">{selectedBill.items_count} items</span>
                </div>

                <div className="flex justify-between items-baseline border-t border-[#E6E6E6] pt-2">
                  <span className="text-[#6B6B6B] text-[15px]">{STRINGS.grandTotalLabel}:</span>
                  <span className="font-bold text-[#1A1A1A] text-[20px]">
                    {formatRupees(selectedBill.total)} ({selectedBill.payment_mode})
                  </span>
                </div>
              </div>

              {/* Re-send Action Buttons */}
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    const message = buildWhatsAppMessage({
                      invoice: {
                        id: selectedBill.id,
                        invoice_number: selectedBill.bill_number,
                        client_request_id: '',
                        customer_id: '',
                        subtotal: selectedBill.total,
                        discount_total: 0,
                        voucher_total: 0,
                        grand_total: selectedBill.total,
                        payment_mode: selectedBill.payment_mode,
                        status: 'FINALIZED',
                        finalized_at: new Date().toISOString(),
                      },
                      items: [],
                    });
                    const url = getWhatsAppUrl(selectedBill.customer_phone, message);
                    window.open(url, '_blank');
                  }}
                >
                  {STRINGS.sendWhatsAppBtn}
                </Button>

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    downloadInvoicePdf({
                      invoice: {
                        id: selectedBill.id,
                        invoice_number: selectedBill.bill_number,
                        client_request_id: '',
                        customer_id: '',
                        subtotal: selectedBill.total,
                        discount_total: 0,
                        voucher_total: 0,
                        grand_total: selectedBill.total,
                        payment_mode: selectedBill.payment_mode,
                        status: 'FINALIZED',
                        finalized_at: new Date().toISOString(),
                      },
                      items: [],
                    });
                  }}
                >
                  {STRINGS.shareFilesBtn}
                </Button>

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={async () => {
                    const text = `FEVER Bill ${selectedBill.bill_number}: Total ${formatRupees(selectedBill.total)}`;
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copied!' : STRINGS.copyMessageBtn}
                </Button>

                <a
                  href={getSmsUrl(selectedBill.customer_phone, `FEVER Bill ${selectedBill.bill_number}: Total ${formatRupees(selectedBill.total)}`)}
                  className="min-h-[52px] px-5 py-3 rounded-[8px] font-semibold text-[17px] flex items-center justify-center gap-2 border bg-[#F6F6F4] text-[#1A1A1A] border-[#E6E6E6] hover:bg-[#EFEFEA]"
                >
                  {STRINGS.sendSmsBtn}
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <div className="pb-2 border-b border-[#E6E6E6]">
              <h1 className="text-[20px] font-bold text-[#1A1A1A]">{STRINGS.navHistory}</h1>
            </div>

            <TextField
              placeholder="Search by bill number or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex flex-col divide-y divide-[#E6E6E6] border border-[#E6E6E6] rounded-[8px] overflow-hidden bg-white">
              {filteredBills.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBill(b)}
                  className="p-3.5 text-left flex items-center justify-between hover:bg-[#F6F6F4] transition-colors"
                >
                  <div>
                    <div className="font-bold text-[#1A1A1A] text-[17px]">{b.bill_number}</div>
                    <div className="text-[15px] text-[#6B6B6B]">
                      {b.time} • {b.customer_phone}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#1A1A1A] text-[17px]">{formatRupees(b.total)}</div>
                    <div className="text-[15px] text-[#6B6B6B]">{b.payment_mode}</div>
                  </div>
                </button>
              ))}

              {filteredBills.length === 0 && (
                <div className="p-8 text-center text-[#6B6B6B] text-[17px]">
                  No bills found matching your search.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
