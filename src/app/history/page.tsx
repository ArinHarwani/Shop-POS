'use client';

import React, { useState, useEffect } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { Invoice, InvoiceItem, Customer, Voucher, Gift } from '@/types';
import { DataService } from '@/lib/data-service';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { buildWhatsAppMessage, getWhatsAppUrl, getSmsUrl } from '@/lib/whatsapp';
import { downloadInvoicePdf } from '@/lib/pdf';
import { formatIstDate } from '@/lib/rewards';
import { getActiveRole } from '@/lib/storage';

export default function HistoryPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<Invoice | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<{
    items: InvoiceItem[];
    customer?: Customer;
    vouchers: Voucher[];
    gift?: Gift | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadHistory = async () => {
    try {
      const all = await DataService.getInvoices();
      setInvoices(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
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

  const filteredBills = invoices.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.invoice_number.toLowerCase().includes(q) ||
      (b.customer?.phone_e164 && b.customer.phone_e164.includes(q)) ||
      (b.customer?.name && b.customer.name.toLowerCase().includes(q))
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
                  <span className="text-[#6B6B6B] text-[15px]">Date & Time:</span>
                  <span className="font-semibold text-[#1A1A1A] text-[16px]">
                    {formatIstDate(selectedBill.finalized_at)}
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

                {selectedBill.status === 'CANCELLED' && (
                  <div className="p-2 bg-[#FEE2E2] text-[#B91C1C] rounded-[6px] text-[14px] font-semibold">
                    CANCELLED / VOIDED: {selectedBill.cancel_reason || 'By owner'}
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

                {/* Owner Void / Cancel Bill Action */}
                {getActiveRole() === 'owner' && selectedBill.status !== 'CANCELLED' && (
                  <div className="pt-2 border-t border-[#E6E6E6]">
                    <Button
                      variant="danger"
                      fullWidth
                      onClick={async () => {
                        const reason = window.prompt('Please enter the reason for voiding/cancelling this bill:');
                        if (!reason || !reason.trim()) return;
                        try {
                          await DataService.cancelInvoice(selectedBill.id, reason.trim(), true);
                          alert('Bill cancelled. Inventory stock restored and associated vouchers voided.');
                          await loadHistory();
                          setSelectedBill(null);
                          setSelectedDetails(null);
                        } catch (err: any) {
                          alert(`Error cancelling bill: ${err.message || 'Unknown error'}`);
                        }
                      }}
                    >
                      Void / Cancel Bill (Owner)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <div className="pb-2 border-b border-[#E6E6E6]">
              <h1 className="text-[20px] font-bold text-[#1A1A1A]">{STRINGS.navHistory}</h1>
            </div>

            {invoices.length > 0 && (
              <TextField
                placeholder="Search by bill number or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}

            {invoices.length === 0 ? (
              <div className="py-14 px-4 rounded-[8px] border border-[#E6E6E6] bg-[#F6F6F4] text-center flex flex-col items-center justify-center">
                <span className="text-[28px] mb-2">📜</span>
                <div className="text-[17px] font-bold text-[#1A1A1A] mb-1">
                  No bills in history
                </div>
                <p className="text-[14px] text-[#6B6B6B] max-w-[280px]">
                  All finalized sales will be securely archived here with search and reprint options.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[#E6E6E6] border border-[#E6E6E6] rounded-[8px] overflow-hidden bg-white">
                {filteredBills.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelectBill(b)}
                    className="p-3.5 text-left flex items-center justify-between hover:bg-[#F6F6F4] transition-colors"
                  >
                    <div>
                      <div className="font-bold text-[#1A1A1A] text-[17px]">{b.invoice_number}</div>
                      <div className="text-[15px] text-[#6B6B6B]">
                        {formatIstDate(b.finalized_at)} • {b.customer?.phone_e164 || 'No phone'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#1A1A1A] text-[17px]">{formatRupees(b.grand_total)}</div>
                      <div className="text-[15px] text-[#6B6B6B]">{b.payment_mode}</div>
                    </div>
                  </button>
                ))}

                {filteredBills.length === 0 && (
                  <div className="p-8 text-center text-[#6B6B6B] text-[17px]">
                    No bills found matching "{search}".
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
