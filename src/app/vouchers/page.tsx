'use client';

import React, { useState } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { DataService } from '@/lib/data-service';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useRouter } from 'next/navigation';
import { formatIstDate, isVoucherExpired } from '@/lib/rewards';

interface CheckedVoucherState {
  code: string;
  status: 'VALID' | 'USED' | 'EXPIRED' | 'CANCELLED' | 'NOT_FOUND';
  face_value: number;
  used_at?: string;
  expires_at?: string;
  min_purchase?: number;
  customer_phone?: string;
}

export default function VouchersPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [checkedVoucher, setCheckedVoucher] = useState<CheckedVoucherState | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usedOnBillMessage, setUsedOnBillMessage] = useState<string | null>(null);

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUsedOnBillMessage(null);
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setSearched(true);

    try {
      const result = await DataService.lookupVoucher(clean);
      if (result && result.voucher) {
        const v = result.voucher;
        const expired = v.status === 'EXPIRED' || (v.expires_at ? isVoucherExpired(v.expires_at) : false);
        const statusMap: Record<string, CheckedVoucherState['status']> = {
          ISSUED: expired ? 'EXPIRED' : 'VALID',
          REDEEMED: 'USED',
          EXPIRED: 'EXPIRED',
          CANCELLED: 'CANCELLED',
        };

        setCheckedVoucher({
          code: v.code,
          status: statusMap[v.status] || (expired ? 'EXPIRED' : 'VALID'),
          face_value: v.face_value,
          expires_at: v.expires_at || undefined,
          min_purchase: v.min_purchase || undefined,
          used_at: v.redeemed_at || undefined,
          customer_phone: result.customer?.phone_e164,
        });
      } else {
        setCheckedVoucher({
          code: clean,
          status: 'NOT_FOUND',
          face_value: 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseOnBill = () => {
    if (!checkedVoucher || checkedVoucher.status !== 'VALID') return;
    try {
      localStorage.setItem(
        'attached_voucher',
        JSON.stringify({
          code: checkedVoucher.code,
          face_value: checkedVoucher.face_value,
          expires_at: checkedVoucher.expires_at,
          min_purchase: checkedVoucher.min_purchase || 3000,
        })
      );
    } catch {
      // ignore localStorage quota errors
    }
    setUsedOnBillMessage(`Voucher ${checkedVoucher.code} attached! Redirecting to billing...`);
    setTimeout(() => {
      router.push('/');
    }, 700);
  };

  return (
    <div className="w-full flex-1 flex justify-center bg-white">
      <div className="w-full max-w-[520px] flex flex-col min-h-[calc(100vh-64px)] px-4 py-4 sm:py-6">
        <div className="flex flex-col gap-4">
          <div className="pb-2 border-b border-[#E6E6E6]">
            <h1 className="text-[20px] font-bold text-[#1A1A1A]">{STRINGS.navVouchers}</h1>
          </div>

          {/* Large box "Enter voucher code" and "Check" button */}
          <form onSubmit={handleCheck} className="flex gap-2 items-start">
            <div className="flex-1">
              <TextField
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={STRINGS.voucherCodePlaceholder}
                autoFocus
              />
            </div>
            <Button type="submit" variant="primary" disabled={loading || !code.trim()}>
              {loading ? 'Checking...' : STRINGS.checkVoucherBtn}
            </Button>
          </form>

          {usedOnBillMessage && (
            <div className="p-3 bg-[#DCFCE7] text-[#15803D] rounded-[8px] border border-[#86EFAC] text-[15px] font-semibold">
              {usedOnBillMessage}
            </div>
          )}

          {/* Result Status Card */}
          {searched && checkedVoucher && (
            <div className="bg-[#F6F6F4] p-4 rounded-[8px] border border-[#E6E6E6] flex flex-col gap-3 mt-1">
              <div className="flex justify-between items-center border-b border-[#E6E6E6] pb-2">
                <span className="font-mono font-bold text-[18px] text-[#1A1A1A]">
                  {checkedVoucher.code}
                </span>
                {checkedVoucher.status === 'VALID' && (
                  <span className="text-[13px] font-bold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D]">
                    VALID
                  </span>
                )}
                {checkedVoucher.status === 'USED' && (
                  <span className="text-[13px] font-bold px-2 py-0.5 rounded bg-[#FEF3C7] text-[#B45309]">
                    ALREADY USED
                  </span>
                )}
                {checkedVoucher.status === 'EXPIRED' && (
                  <span className="text-[13px] font-bold px-2 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C]">
                    EXPIRED
                  </span>
                )}
                {checkedVoucher.status === 'CANCELLED' && (
                  <span className="text-[13px] font-bold px-2 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C]">
                    CANCELLED
                  </span>
                )}
                {checkedVoucher.status === 'NOT_FOUND' && (
                  <span className="text-[13px] font-bold px-2 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C]">
                    NOT FOUND
                  </span>
                )}
              </div>

              {/* Green: Valid */}
              {checkedVoucher.status === 'VALID' && (
                <div className="flex flex-col gap-3">
                  <div className="text-[#15803D] font-bold text-[20px]">
                    {formatRupees(checkedVoucher.face_value)} off
                  </div>
                  <div className="text-[14px] text-[#1A1A1A] flex flex-col gap-1">
                    {checkedVoucher.expires_at && (
                      <div>
                        <span className="font-medium text-[#6B6B6B]">Valid till: </span>
                        <span className="font-semibold">{formatIstDate(checkedVoucher.expires_at)}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-[#6B6B6B]">Minimum bill: </span>
                      <span className="font-semibold">Rs 3,000 in-store purchase</span>
                    </div>
                    <div className="text-[13px] text-[#6B6B6B] pt-1">
                      One voucher per bill. Not exchangeable for cash.
                    </div>
                  </div>
                  <Button type="button" variant="primary" fullWidth onClick={handleUseOnBill}>
                    {STRINGS.useOnBillBtn}
                  </Button>
                </div>
              )}

              {/* Amber: Already used */}
              {checkedVoucher.status === 'USED' && (
                <div className="flex flex-col gap-1 text-[#B45309]">
                  <div className="font-bold text-[17px]">
                    This voucher was already used {checkedVoucher.used_at ? `on ${formatIstDate(checkedVoucher.used_at)}` : ''}.
                  </div>
                  <div className="text-[13px] text-[#6B6B6B]">
                    Each voucher can be redeemed once only.
                  </div>
                </div>
              )}

              {/* Red: Expired */}
              {checkedVoucher.status === 'EXPIRED' && (
                <div className="flex flex-col gap-1 text-[#B91C1C]">
                  <div className="font-bold text-[17px]">
                    This voucher expired {checkedVoucher.expires_at ? `on ${formatIstDate(checkedVoucher.expires_at)}` : ''}.
                  </div>
                  <div className="text-[13px] text-[#6B6B6B]">
                    Expired vouchers cannot be redeemed.
                  </div>
                </div>
              )}

              {/* Red: Cancelled */}
              {checkedVoucher.status === 'CANCELLED' && (
                <div className="flex flex-col gap-1 text-[#B91C1C]">
                  <div className="font-bold text-[17px]">
                    This voucher was cancelled with its source bill.
                  </div>
                </div>
              )}

              {/* Red: Not found */}
              {checkedVoucher.status === 'NOT_FOUND' && (
                <div className="text-[#B91C1C] font-bold text-[16px]">
                  {STRINGS.voucherNotFound}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
