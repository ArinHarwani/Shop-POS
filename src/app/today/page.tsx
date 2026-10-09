'use client';

import React, { useState } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { FIXTURE_TODAY_STATS, FIXTURE_TODAY_BILLS, FixtureBill } from '@/lib/fixtures';
import { Button } from '@/components/ui/Button';
import { buildWhatsAppMessage, getWhatsAppUrl, getSmsUrl } from '@/lib/whatsapp';
import { downloadInvoicePdf } from '@/lib/pdf';

export default function TodayPage() {
  const [selectedBill, setSelectedBill] = useState<FixtureBill | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="w-full flex-1 flex justify-center bg-white">
      <div className="w-full max-w-[520px] flex flex-col min-h-[calc(100vh-64px)] px-4 py-4 sm:py-6">
        {selectedBill ? (
          /* ========================================================= */
          /* BILL DETAIL VIEW (Screen 5)                               */
          /* Repeats Done screen buttons so a message can be re-sent   */
          /* ========================================================= */
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

                {selectedBill.vouchers_earned.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-[#E6E6E6] pt-2 text-[15px]">
                    <span className="text-[#6B6B6B]">Vouchers issued:</span>
                    {selectedBill.vouchers_earned.map((c) => (
                      <span key={c} className="font-mono font-semibold text-[#1A1A1A]">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {selectedBill.gift_earned && (
                  <div className="flex justify-between items-baseline border-t border-[#E6E6E6] pt-2 text-[15px]">
                    <span className="text-[#6B6B6B]">Gift status:</span>
                    <span className="font-semibold text-[#1A1A1A]">
                      {selectedBill.gift_earned} ({selectedBill.gift_claimed ? 'Claimed' : 'Waiting for collection'})
                    </span>
                  </div>
                )}
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
                      items: [
                        {
                          product_id: 'p1',
                          item_number_snapshot: '847291',
                          description_snapshot: 'Trendy Garment',
                          quantity: selectedBill.items_count,
                          unit_price_snapshot: Math.floor(selectedBill.total / selectedBill.items_count),
                          line_total: selectedBill.total,
                        },
                      ],
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
                      items: [
                        {
                          product_id: 'p1',
                          item_number_snapshot: '847291',
                          description_snapshot: 'Trendy Garment',
                          quantity: selectedBill.items_count,
                          unit_price_snapshot: Math.floor(selectedBill.total / selectedBill.items_count),
                          line_total: selectedBill.total,
                        },
                      ],
                      customer: {
                        id: 'c',
                        phone_e164: selectedBill.customer_phone,
                        name: selectedBill.customer_name,
                        marketing_consent: false,
                      },
                    });
                  }}
                >
                  {STRINGS.shareFilesBtn}
                </Button>

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={async () => {
                    const text = `FEVER Bill ${selectedBill.bill_number}: Total ${formatRupees(selectedBill.total)} (${selectedBill.payment_mode})`;
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
          /* ========================================================= */
          /* TODAY DASHBOARD VIEW                                      */
          /* ========================================================= */
          <div className="flex-1 flex flex-col gap-5">
            <div className="pb-2 border-b border-[#E6E6E6]">
              <h1 className="text-[20px] font-bold text-[#1A1A1A]">{STRINGS.navToday}</h1>
            </div>

            {/* Four Simple Number Blocks (Flat borders, no shadows) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Sales Today */}
              <div className="p-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] flex flex-col gap-1">
                <span className="text-[15px] font-medium text-[#6B6B6B]">{STRINGS.salesTodayTitle}</span>
                <span className="text-[24px] font-bold text-[#1A1A1A]">
                  {formatRupees(FIXTURE_TODAY_STATS.salesToday)}
                </span>
              </div>

              {/* Bills */}
              <div className="p-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] flex flex-col gap-1">
                <span className="text-[15px] font-medium text-[#6B6B6B]">{STRINGS.billsCountTitle}</span>
                <span className="text-[24px] font-bold text-[#1A1A1A]">
                  {FIXTURE_TODAY_STATS.billsCount}
                </span>
              </div>

              {/* Items Sold */}
              <div className="p-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] flex flex-col gap-1">
                <span className="text-[15px] font-medium text-[#6B6B6B]">{STRINGS.itemsSoldCountTitle}</span>
                <span className="text-[24px] font-bold text-[#1A1A1A]">
                  {FIXTURE_TODAY_STATS.itemsSold}
                </span>
              </div>

              {/* Gifts Waiting */}
              <div className="p-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] flex flex-col gap-1">
                <span className="text-[15px] font-medium text-[#6B6B6B]">{STRINGS.giftsWaitingTitle}</span>
                <span className={`text-[24px] font-bold ${FIXTURE_TODAY_STATS.giftsWaiting > 0 ? 'text-[#B45309]' : 'text-[#1A1A1A]'}`}>
                  {FIXTURE_TODAY_STATS.giftsWaiting}
                </span>
              </div>
            </div>

            {/* Plain List of Today's Bills */}
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-[17px] font-bold text-[#1A1A1A]">
                {STRINGS.todaysBillsHeading}
              </span>

              <div className="flex flex-col divide-y divide-[#E6E6E6] border border-[#E6E6E6] rounded-[8px] bg-white overflow-hidden">
                {FIXTURE_TODAY_BILLS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBill(b)}
                    className="p-3.5 text-left flex items-center justify-between hover:bg-[#F6F6F4] transition-colors"
                  >
                    <div>
                      <div className="font-bold text-[#1A1A1A] text-[17px]">{b.bill_number}</div>
                      <div className="text-[15px] text-[#6B6B6B] mt-0.5">
                        {b.time} • {b.items_count} garments
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-[#1A1A1A] text-[17px]">
                        {formatRupees(b.total)}
                      </div>
                      <div className="text-[15px] text-[#6B6B6B]">{b.payment_mode}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
