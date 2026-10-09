'use client';

import React, { useState, useEffect } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { Invoice, InvoiceItem, Customer, Voucher, Gift } from '@/types';
import { DataService } from '@/lib/data-service';
import { Button } from '@/components/ui/Button';
import { buildWhatsAppMessage, getWhatsAppUrl, getSmsUrl } from '@/lib/whatsapp';
import { downloadInvoicePdf } from '@/lib/pdf';
import { formatIstDate } from '@/lib/rewards';

export default function TodayPage() {
  const [stats, setStats] = useState({
    salesToday: 0,
    billsCount: 0,
    itemsSold: 0,
    giftsWaiting: 0,
  });
  const [bills, setBills] = useState<Invoice[]>([]);
  const [selectedBill, setSelectedBill] = useState<Invoice | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<{
    items: InvoiceItem[];
    customer?: Customer;
    vouchers: Voucher[];
    gift?: Gift | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTodayData = async () => {
    try {
      const s = await DataService.getDashboardStats();
      setStats({
        salesToday: s.todaySales,
        billsCount: s.invoiceCount,
        itemsSold: s.itemsSold,
        giftsWaiting: s.giftsPending,
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      const allInvoices = await DataService.getInvoices({ date: todayStr });
      setBills(allInvoices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayData();
  }, []);

  const handleSelectBill = async (bill: Invoice) => {
    setSelectedBill(bill);
    const details = await DataService.getInvoiceDetails(bill.id);
    if (details) {
      setSelectedDetails({
        items: details.items,
        customer: details.customer,
        vouchers: details.vouchers,
        gift: details.gift,
      });
    } else {
      setSelectedDetails({
        items: bill.items || [],
        customer: bill.customer,
        vouchers: [],
        gift: null,
      });
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full flex-1 flex justify-center bg-white">
      <div className="w-full max-w-[520px] flex flex-col min-h-[calc(100vh-64px)] px-4 py-4 sm:py-6">
        {selectedBill ? (
          /* ========================================================= */
          /* BILL DETAIL VIEW (Screen 5)                               */
          /* ========================================================= */
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E6]">
                <h1 className="text-[20px] font-bold text-[#1A1A1A]">
                  Bill {selectedBill.invoice_number}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBill(null);
                    setSelectedDetails(null);
                  }}
                  className="text-[15px] font-medium text-[#6B6B6B] hover:text-[#1A1A1A]"
                >
                  {STRINGS.backBtn}
                </button>
              </div>

              {/* Calm Summary */}
              <div className="bg-[#F6F6F4] p-4 rounded-[8px] border border-[#E6E6E6] flex flex-col gap-2.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">Time:</span>
                  <span className="font-semibold text-[#1A1A1A] text-[17px]">
                    {formatTime(selectedBill.finalized_at)} ({formatIstDate(selectedBill.finalized_at)})
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">Customer:</span>
                  <span className="font-semibold text-[#1A1A1A] text-[17px]">
                    {selectedDetails?.customer?.name || 'Walk-in'} (
                    {selectedDetails?.customer?.phone_e164 || 'No phone'})
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B6B6B] text-[15px]">Garments:</span>
                  <span className="font-semibold text-[#1A1A1A] text-[17px]">
                    {selectedDetails?.items?.reduce((s, it) => s + it.quantity, 0) || 0} items
                  </span>
                </div>

                {/* Items line breakdown */}
                {selectedDetails?.items && selectedDetails.items.length > 0 && (
                  <div className="border-t border-[#E6E6E6] pt-2 flex flex-col gap-1">
                    <span className="text-[#6B6B6B] text-[14px]">Items billed:</span>
                    {selectedDetails.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[14px]">
                        <span className="text-[#1A1A1A]">
                          #{item.item_number_snapshot} {item.description_snapshot} × {item.quantity}
                        </span>
                        <span className="font-semibold text-[#1A1A1A]">
                          {formatRupees(item.line_total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-baseline border-t border-[#E6E6E6] pt-2">
                  <span className="text-[#6B6B6B] text-[15px]">{STRINGS.grandTotalLabel}:</span>
                  <span className="font-bold text-[#1A1A1A] text-[20px]">
                    {formatRupees(selectedBill.grand_total)} ({selectedBill.payment_mode})
                  </span>
                </div>

                {selectedDetails?.vouchers && selectedDetails.vouchers.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-[#E6E6E6] pt-2 text-[15px]">
                    <span className="text-[#6B6B6B]">Vouchers issued:</span>
                    {selectedDetails.vouchers.map((v) => (
                      <span key={v.id} className="font-mono font-semibold text-[#15803D]">
                        {v.code} ({formatRupees(v.face_value)})
                      </span>
                    ))}
                  </div>
                )}

                {selectedDetails?.gift && (
                  <div className="flex justify-between items-baseline border-t border-[#E6E6E6] pt-2 text-[15px]">
                    <span className="text-[#6B6B6B]">Gift status:</span>
                    <span className="font-semibold text-[#1A1A1A]">
                      {selectedDetails.gift.description} (
                      {selectedDetails.gift.status === 'COLLECTED'
                        ? 'Claimed'
                        : 'Waiting for collection'}
                      )
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
                        ...selectedBill,
                        customer: selectedDetails?.customer || selectedBill.customer,
                      },
                      items: selectedDetails?.items || [],
                      vouchers: selectedDetails?.vouchers,
                      gift: selectedDetails?.gift,
                    });
                    const phone = selectedDetails?.customer?.phone_e164 || '';
                    const url = getWhatsAppUrl(phone, message);
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
                      invoice: selectedBill,
                      items: selectedDetails?.items || [],
                      customer: selectedDetails?.customer,
                      vouchers: selectedDetails?.vouchers,
                      gift: selectedDetails?.gift,
                    });
                  }}
                >
                  {STRINGS.shareFilesBtn}
                </Button>

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={async () => {
                    const text = `FEVER Bill ${selectedBill.invoice_number}: Total ${formatRupees(
                      selectedBill.grand_total
                    )} (${selectedBill.payment_mode})`;
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copied!' : STRINGS.copyMessageBtn}
                </Button>

                {selectedDetails?.customer?.phone_e164 && (
                  <a
                    href={getSmsUrl(
                      selectedDetails.customer.phone_e164,
                      `FEVER Bill ${selectedBill.invoice_number}: Total ${formatRupees(
                        selectedBill.grand_total
                      )}`
                    )}
                    className="min-h-[52px] px-5 py-3 rounded-[8px] font-semibold text-[17px] flex items-center justify-center gap-2 border bg-[#F6F6F4] text-[#1A1A1A] border-[#E6E6E6] hover:bg-[#EFEFEA]"
                  >
                    {STRINGS.sendSmsBtn}
                  </a>
                )}
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
                <span className="text-[15px] font-medium text-[#6B6B6B]">
                  {STRINGS.salesTodayTitle}
                </span>
                <span className="text-[24px] font-bold text-[#1A1A1A]">
                  {formatRupees(stats.salesToday)}
                </span>
              </div>

              {/* Bills */}
              <div className="p-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] flex flex-col gap-1">
                <span className="text-[15px] font-medium text-[#6B6B6B]">
                  {STRINGS.billsCountTitle}
                </span>
                <span className="text-[24px] font-bold text-[#1A1A1A]">
                  {stats.billsCount}
                </span>
              </div>

              {/* Items Sold */}
              <div className="p-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] flex flex-col gap-1">
                <span className="text-[15px] font-medium text-[#6B6B6B]">
                  {STRINGS.itemsSoldCountTitle}
                </span>
                <span className="text-[24px] font-bold text-[#1A1A1A]">
                  {stats.itemsSold}
                </span>
              </div>

              {/* Gifts Waiting */}
              <div className="p-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] flex flex-col gap-1">
                <span className="text-[15px] font-medium text-[#6B6B6B]">
                  {STRINGS.giftsWaitingTitle}
                </span>
                <span
                  className={`text-[24px] font-bold ${
                    stats.giftsWaiting > 0 ? 'text-[#B45309]' : 'text-[#1A1A1A]'
                  }`}
                >
                  {stats.giftsWaiting}
                </span>
              </div>
            </div>

            {/* Today's Bills */}
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-[17px] font-bold text-[#1A1A1A]">
                {STRINGS.todaysBillsHeading}
              </span>

              {bills.length === 0 ? (
                <div className="py-12 px-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] text-center flex flex-col items-center justify-center">
                  <span className="text-[28px] mb-2">🧾</span>
                  <div className="text-[17px] font-bold text-[#1A1A1A] mb-1">
                    No bills yet today
                  </div>
                  <p className="text-[14px] text-[#6B6B6B] max-w-[280px]">
                    Bills finalized on the Sell tab will automatically appear here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#E6E6E6] border border-[#E6E6E6] rounded-[8px] bg-white overflow-hidden">
                  {bills.map((b) => {
                    const garmentCount = b.items?.reduce((s, it) => s + it.quantity, 0) || 0;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectBill(b)}
                        className="p-3.5 text-left flex items-center justify-between hover:bg-[#F6F6F4] transition-colors"
                      >
                        <div>
                          <div className="font-bold text-[#1A1A1A] text-[17px]">
                            {b.invoice_number}
                          </div>
                          <div className="text-[15px] text-[#6B6B6B] mt-0.5">
                            {formatTime(b.finalized_at)} • {garmentCount} {garmentCount === 1 ? 'garment' : 'garments'}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-[#1A1A1A] text-[17px]">
                            {formatRupees(b.grand_total)}
                          </div>
                          <div className="text-[15px] text-[#6B6B6B]">{b.payment_mode}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
