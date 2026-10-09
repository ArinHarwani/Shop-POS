'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Gift,
  Ticket,
  Lock,
  X,
  FileDown,
} from 'lucide-react';
import { Invoice, Gift as GiftType, Customer, InvoiceItem } from '@/types';
import { DataService } from '@/lib/data-service';
import { exportAllDataToCsv } from '@/lib/csv';
import { formatDisplayDate } from '@/lib/whatsapp';
import { getActiveRole } from '@/lib/storage';
import { downloadInvoicePdf } from '@/lib/pdf';

export default function ReportsPage() {
  const [stats, setStats] = useState<{
    todaySales: number;
    invoiceCount: number;
    itemsSold: number;
    averageBill: number;
    paymentSplit: { Cash: number; UPI: number; Card: number; Other: number };
    vouchersIssued: number;
    giftsPending: number;
    pendingGiftsList: GiftType[];
  } | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [role, setRole] = useState<'owner' | 'staff'>('owner');

  // Filters
  const [filterInvoiceNum, setFilterInvoiceNum] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterPayment, setFilterPayment] = useState('ALL');

  // Modal: View Invoice Details
  const [selectedInvoice, setSelectedInvoice] = useState<{
    invoice: Invoice;
    items: InvoiceItem[];
    customer?: Customer;
  } | null>(null);

  // Modal: Cancel Invoice (Owner only)
  const [cancelModalInvoice, setCancelModalInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer return / exchange');
  const [overrideRedeemed, setOverrideRedeemed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    setRole(getActiveRole());
  }, []);

  const loadData = async () => {
    const s = await DataService.getDashboardStats();
    setStats(s);

    const invs = await DataService.getInvoices({
      invoiceNumber: filterInvoiceNum || undefined,
      customerPhone: filterPhone || undefined,
      paymentMode: filterPayment !== 'ALL' ? filterPayment : undefined,
    });
    setInvoices(invs);
  };

  const handleApplyFilters = async () => {
    const invs = await DataService.getInvoices({
      invoiceNumber: filterInvoiceNum || undefined,
      customerPhone: filterPhone || undefined,
      paymentMode: filterPayment !== 'ALL' ? filterPayment : undefined,
    });
    setInvoices(invs);
  };

  // One-tap Mark Gift Collected (RWD-2)
  const handleMarkGiftCollected = async (giftId: string) => {
    try {
      await DataService.markGiftCollected(giftId);
      setNotification('Gift marked as COLLECTED!');
      setTimeout(() => setNotification(null), 3000);
      await loadData();
    } catch (err: any) {
      setNotification(`Failed: ${err.message}`);
    }
  };

  // View invoice lines
  const handleViewInvoiceDetails = async (invoiceId: string) => {
    const details = await DataService.getInvoiceDetails(invoiceId);
    if (details) {
      setSelectedInvoice(details);
    }
  };

  // Owner Cancel Bill (BIL-8)
  const handleExecuteCancel = async () => {
    if (!cancelModalInvoice) return;
    setCancelError(null);
    try {
      await DataService.cancelInvoice(cancelModalInvoice.id, cancelReason, overrideRedeemed);
      setCancelModalInvoice(null);
      setNotification(`Invoice ${cancelModalInvoice.invoice_number} cancelled and stock restored!`);
      setTimeout(() => setNotification(null), 3000);
      await loadData();
    } catch (err: any) {
      setCancelError(err.message || 'Cancellation failed');
    }
  };

  // Export All Tables to CSV (RPT-3)
  const handleExportAll = async () => {
    const exportData = await DataService.getAllDataForExport();
    exportAllDataToCsv(exportData);
    setNotification('Export complete: Downloaded CSV files for all tables off the device.');
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col space-y-6">
      {/* Page Header & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-rose-500" />
            <span>Event Sales & Reports</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time sales tracking, payment splits, gift fulfillment, and daily CSV backups
          </p>
        </div>

        {/* Daily CSV Export All Button (RPT-3 & Change #11) */}
        <button
          onClick={handleExportAll}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white font-bold text-xs border border-slate-700 shadow-lg flex items-center justify-center gap-2 transition-all touch-target"
        >
          <Download className="w-4 h-4 text-rose-400" />
          <span>Export All Data (CSV)</span>
        </button>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* DASHBOARD STATS (RPT-1) */}
      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Today's Sales */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-rose-400" /> Today's Sales
              </span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                Rs {stats.todaySales}
              </div>
              <span className="text-[11px] text-slate-500">Excluding voided bills</span>
            </div>

            {/* Invoices Count */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-400" /> Bills Finalized
              </span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats.invoiceCount}
              </div>
              <span className="text-[11px] text-slate-500">Avg bill: Rs {stats.averageBill}</span>
            </div>

            {/* Garments Sold */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Garments Sold
              </span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats.itemsSold}
              </div>
              <span className="text-[11px] text-slate-500">Total units moved</span>
            </div>

            {/* Vouchers & Pending Gifts */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-400" /> Gifts & Vouchers
              </span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats.vouchersIssued} <span className="text-xs font-normal text-slate-400">vouchers</span>
              </div>
              <span className="text-[11px] text-amber-400 font-medium">
                {stats.giftsPending} gifts pending collection
              </span>
            </div>
          </div>

          {/* Payment Mode Breakdown */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Payment Split Breakdown
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-black/30 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">UPI</span>
                <span className="font-mono font-bold text-white text-base">
                  Rs {stats.paymentSplit.UPI}
                </span>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Cash</span>
                <span className="font-mono font-bold text-white text-base">
                  Rs {stats.paymentSplit.Cash}
                </span>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Card</span>
                <span className="font-mono font-bold text-white text-base">
                  Rs {stats.paymentSplit.Card}
                </span>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block">Other</span>
                <span className="font-mono font-bold text-white text-base">
                  Rs {stats.paymentSplit.Other}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Gifts Quick Action Section (RWD-2) */}
          {stats.pendingGiftsList.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>Pending Gifts to be Handed Over ({stats.pendingGiftsList.length})</span>
                </span>
              </div>
              <div className="divide-y divide-amber-900/30 max-h-48 overflow-y-auto">
                {stats.pendingGiftsList.map((g) => (
                  <div key={g.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-white">{g.description}</div>
                      <div className="text-[11px] text-slate-400">
                        Date: {formatDisplayDate(g.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleMarkGiftCollected(g.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
                    >
                      Mark Collected ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INVOICE HISTORY & FILTERS (RPT-2) */}
      <div className="space-y-4">
        {/* Filter Controls */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-rose-400" />
            <span>Invoice History & Search</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={filterInvoiceNum}
              onChange={(e) => setFilterInvoiceNum(e.target.value)}
              placeholder="Invoice # (e.g. TR-0001)"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <input
              type="text"
              value={filterPhone}
              onChange={(e) => setFilterPhone(e.target.value)}
              placeholder="Customer Phone"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
            >
              Filter Invoices
            </button>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer Phone</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Grand Total</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-rose-300">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDisplayDate(inv.finalized_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-200">
                      {inv.customer?.phone_e164 || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {inv.items?.length || 0} items
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      Rs {inv.grand_total}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {inv.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          inv.status === 'FINALIZED'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                            : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleViewInvoiceDetails(inv.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                      >
                        View
                      </button>
                      {inv.status === 'FINALIZED' && (
                        <button
                          onClick={() => setCancelModalInvoice(inv)}
                          className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/40"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      No invoices recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* VIEW INVOICE MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111726] border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  Invoice {selectedInvoice.invoice.invoice_number}
                </h3>
                <p className="text-xs text-slate-400">
                  {formatDisplayDate(selectedInvoice.invoice.finalized_at)} •{' '}
                  {selectedInvoice.invoice.payment_mode}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="bg-slate-900 p-3 rounded-xl text-xs space-y-1">
              <div>
                <span className="text-slate-500">Customer: </span>
                <span className="font-semibold text-white">
                  {selectedInvoice.customer?.name || 'Walk-in'} (
                  {selectedInvoice.customer?.phone_e164})
                </span>
              </div>
              {selectedInvoice.customer?.instagram_handle && (
                <div>
                  <span className="text-slate-500">Instagram: </span>
                  <span className="font-mono text-rose-400">
                    @{selectedInvoice.customer.instagram_handle}
                  </span>
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Line Items
              </span>
              <div className="divide-y divide-slate-800 text-xs">
                {selectedInvoice.items.map((it) => (
                  <div key={it.id || it.product_id} className="py-2 flex justify-between">
                    <div>
                      <div className="font-medium text-white">
                        {it.description_snapshot} (#{it.item_number_snapshot})
                      </div>
                      <div className="text-slate-400">
                        Qty {it.quantity} @ Rs {it.unit_price_snapshot} each
                      </div>
                    </div>
                    <div className="font-mono font-bold text-white">
                      Rs {it.line_total}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">Rs {selectedInvoice.invoice.subtotal}</span>
              </div>
              {selectedInvoice.invoice.discount_total > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount:</span>
                  <span className="font-mono">-Rs {selectedInvoice.invoice.discount_total}</span>
                </div>
              )}
              {selectedInvoice.invoice.voucher_total > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Voucher Applied:</span>
                  <span className="font-mono">-Rs {selectedInvoice.invoice.voucher_total}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-1">
                <span>Grand Total:</span>
                <span className="font-mono text-rose-400">
                  Rs {selectedInvoice.invoice.grand_total}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-800">
              <button
                onClick={() =>
                  downloadInvoicePdf({
                    invoice: selectedInvoice.invoice,
                    items: selectedInvoice.items,
                    customer: selectedInvoice.customer,
                  })
                }
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <FileDown className="w-4 h-4 text-rose-400" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL INVOICE MODAL (Owner only BIL-8) */}
      {cancelModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111726] border border-rose-500/40 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Cancel Bill {cancelModalInvoice.invoice_number}</span>
              </h3>
              {role !== 'owner' && <Lock className="w-4 h-4 text-amber-400" />}
            </div>

            {role !== 'owner' ? (
              <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                Cancellation is restricted to the Owner role. Staff are not permitted to void bills. Switch to Owner role in the header to proceed.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  Cancelling this invoice will:
                  <br />• Restore garment stock on hand
                  <br />• Cancel any unredeemed reward vouchers issued with this bill
                  <br />• Cancel any pending gifts
                </p>

                {cancelError && (
                  <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30">
                    {cancelError}
                  </p>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Cancellation Reason *
                  </label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                    required
                  />
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideRedeemed}
                    onChange={(e) => setOverrideRedeemed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span className="text-[11px] text-slate-400">
                    Owner Override: Proceed even if customer already redeemed a voucher from this bill.
                  </span>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setCancelModalInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Keep Bill
              </button>
              {role === 'owner' && (
                <button
                  onClick={handleExecuteCancel}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/60"
                >
                  Confirm Void & Restore Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
