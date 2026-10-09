'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Receipt,
  Ticket,
  Gift,
  CheckCircle2,
  XCircle,
  AtSign,
  ShoppingBag,
} from 'lucide-react';
import { Customer, Invoice, Voucher, Gift as GiftType } from '@/types';
import { DataService } from '@/lib/data-service';
import { formatDisplayDate } from '@/lib/whatsapp';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    customer: Customer;
    invoices: Invoice[];
    vouchers: Voucher[];
    gifts: GiftType[];
    totalSpend: number;
  } | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const list = await DataService.getCustomers();
    setCustomers(list);
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    const list = await DataService.getCustomers(val);
    setCustomers(list);
  };

  const handleSelectCustomer = async (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    const prof = await DataService.getCustomerProfile(cust.id);
    setProfile(prof);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-rose-500" />
          <span>Customer Directory & Profiles</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Look up shoppers by WhatsApp phone number, name or Instagram ID to view purchase history and rewards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Customer Directory */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by phone, name or Instagram handle..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80 max-h-[600px] overflow-y-auto">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectCustomer(c)}
                className={`w-full p-4 text-left transition-colors flex items-center justify-between gap-3 ${
                  selectedCustomerId === c.id ? 'bg-rose-950/30 border-l-4 border-rose-500' : 'hover:bg-slate-800/40'
                }`}
              >
                <div>
                  <div className="font-bold text-white text-sm">
                    {c.name || 'Walk-in Shopper'}
                  </div>
                  <div className="font-mono text-xs text-rose-300 mt-0.5">
                    {c.phone_e164}
                  </div>
                  {c.instagram_handle && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <AtSign className="w-3 h-3 text-pink-400" />
                      <span>@{c.instagram_handle}</span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                      c.marketing_consent
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {c.marketing_consent ? 'Consented' : 'No Consent'}
                  </span>
                </div>
              </button>
            ))}

            {customers.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                No customers recorded yet. Customers are automatically saved when finalizing bills.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Customer Profile Drawer (CUS-3) */}
        <div className="lg:col-span-7">
          {profile ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-black text-white">
                    {profile.customer.name || 'Walk-in Customer'}
                  </h2>
                  <div className="font-mono text-sm text-rose-400 mt-0.5">
                    {profile.customer.phone_e164}
                  </div>
                  {profile.customer.instagram_handle && (
                    <div className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                      <AtSign className="w-3.5 h-3.5 text-pink-400" />
                      <span>@{profile.customer.instagram_handle}</span>
                    </div>
                  )}
                </div>

                <div className="bg-black/30 p-3 rounded-xl border border-slate-800 text-right">
                  <span className="text-[11px] text-slate-400 block">Total Event Spend</span>
                  <span className="font-mono font-black text-xl text-emerald-400">
                    Rs {profile.totalSpend}
                  </span>
                </div>
              </div>

              {/* Vouchers Earned */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-amber-400" />
                  <span>Reward Vouchers ({profile.vouchers.length})</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {profile.vouchers.map((v) => (
                    <div
                      key={v.id}
                      className="bg-black/30 p-3 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono font-bold text-amber-300">{v.code}</div>
                        <div className="text-slate-400 text-[11px]">Rs {v.face_value} OFF</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.status === 'ISSUED'
                            ? 'bg-emerald-950/40 text-emerald-400'
                            : v.status === 'REDEEMED'
                            ? 'bg-blue-950/40 text-blue-400'
                            : 'bg-rose-950/40 text-rose-400'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                  ))}
                  {profile.vouchers.length === 0 && (
                    <p className="text-xs text-slate-500 italic col-span-2">
                      No vouchers issued yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Gifts Earned */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-rose-400" />
                  <span>Event Gifts ({profile.gifts.length})</span>
                </span>
                <div className="space-y-2 text-xs">
                  {profile.gifts.map((g) => (
                    <div
                      key={g.id}
                      className="bg-black/30 p-3 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <span className="text-white font-medium">{g.description}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.status === 'COLLECTED'
                            ? 'bg-emerald-950/40 text-emerald-400'
                            : 'bg-amber-950/40 text-amber-400'
                        }`}
                      >
                        {g.status === 'COLLECTED' ? 'Collected' : 'Pending Collection'}
                      </span>
                    </div>
                  ))}
                  {profile.gifts.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No gifts issued for this customer.</p>
                  )}
                </div>
              </div>

              {/* Past Invoices */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-blue-400" />
                  <span>Past Invoices ({profile.invoices.length})</span>
                </span>
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  {profile.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 bg-black/20 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono font-bold text-rose-300">
                          {inv.invoice_number}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDisplayDate(inv.finalized_at)} • {inv.payment_mode}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-white">Rs {inv.grand_total}</div>
                        <span
                          className={`text-[10px] font-bold ${
                            inv.status === 'FINALIZED' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {profile.invoices.length === 0 && (
                    <div className="p-4 text-center text-slate-500">No past bills recorded.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <Users className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm font-semibold text-slate-400">Select a Customer</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Pick a customer from the left list to inspect their bills, spent rupee total, and voucher codes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
