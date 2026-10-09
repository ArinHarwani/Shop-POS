'use client';

import React, { useState } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { FIXTURE_VOUCHERS, FixtureVoucher } from '@/lib/fixtures';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useRouter } from 'next/navigation';
import { formatIstDate, isVoucherExpired } from '@/lib/rewards';

export default function VouchersPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [checkedVoucher, setCheckedVoucher] = useState<FixtureVoucher | null>(null);
  const [searched, setSearched] = useState(false);
  const [usedOnBillMessage, setUsedOnBillMessage] = useState<string | null>(null);

  const handleCheck = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUsedOnBillMessage(null);
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setSearched(true);
    const match = FIXTURE_VOUCHERS[clean];
    if (match) {
      // Check expiry against current time
      const expired = match.status === 'EXPIRED' || (match.expires_at ? isVoucherExpired(match.expires_at) : false);
      setCheckedVoucher({
        ...match,
        status: expired ? 'EXPIRED' : match.status,
      });
    } else {
      setCheckedVoucher({
        code: clean,
        status: 'NOT_FOUND',
        face_value: 0,
      });
    }
  };

  const handleUseOnBill = () => {
    if (!checkedVoucher || checkedVoucher.status !== 'VALID') return;
    try {
      localStorage.setItem('attached_voucher', JSON.stringify({
        code: checkedVoucher.code,
        face_value: checkedVoucher.face_value,
        expires_at: checkedVoucher.expires_at,
        min_purchase: checkedVoucher.min_purchase || 3000,
      }));
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
            <Button type="submit" variant="primary">
              {STRINGS.checkVoucherBtn}
            </Button>
          </form>

          {/* Sample test codes for preview */}
          <div className="text-[14px] text-[#6B6B6B] bg-[#F6F6F4] p-3 rounded-[8px] border border-[#E6E6E6] flex flex-col gap-1">
            <span className="font-semibold text-[#1A1A1A]">Sample preview codes:</span>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => { setCode('TRD-K7M2-9QXA'); }}
                className="font-mono text-[#15803D] hover:underline"
              >
                TRD-K7M2-9QXA (Rs 250 Valid)
              </button>
              <button
                type="button"
                onClick={() => { setCode('TRD-H4P8-2WZC'); }}
                className="font-mono text-[#B45309] hover:underline"
              >
                TRD-H4P8-2WZC (Used)
              </button>
              <button
                type="button"
                onClick={() => { setCode('TRD-EXPD-9999'); }}
                className="font-mono text-[#B91C1C] hover:underline"
              >
                TRD-EXPD-9999 (Expired)
              </button>
            </div>
          </div>

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
                    <div>
                      <span className="font-medium text-[#6B6B6B]">Valid till: </span>
                      <span className="font-semibold">{formatIstDate(checkedVoucher.expires_at || '2026-11-11T18:29:59.999Z')}</span>
                    </div>
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
                    This voucher was already used on {formatIstDate(checkedVoucher.used_at) || '09 Oct 2026'}.
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
                    This voucher expired on {formatIstDate(checkedVoucher.expires_at) || 'earlier'}.
                  </div>
                  <div className="text-[13px] text-[#6B6B6B]">
                    Expired vouchers cannot be redeemed.
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

