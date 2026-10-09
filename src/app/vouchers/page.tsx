'use client';

import React, { useState } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { FIXTURE_VOUCHERS, FixtureVoucher } from '@/lib/fixtures';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useRouter } from 'next/navigation';

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
      setCheckedVoucher(match);
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
    setUsedOnBillMessage(`Applied ${checkedVoucher.code} to current bill!`);
    setTimeout(() => {
      router.push('/');
    }, 800);
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
          <div className="text-[15px] text-[#6B6B6B] bg-[#F6F6F4] p-3 rounded-[8px] border border-[#E6E6E6]">
            <span>Try preview codes: </span>
            <button
              type="button"
              onClick={() => { setCode('TRD-K7M2-9QXA'); }}
              className="font-mono text-[#1A1A1A] underline mr-2"
            >
              TRD-K7M2-9QXA (Valid)
            </button>
            <button
              type="button"
              onClick={() => { setCode('TRD-H4P8-2WZC'); }}
              className="font-mono text-[#1A1A1A] underline"
            >
              TRD-H4P8-2WZC (Used)
            </button>
          </div>

          {usedOnBillMessage && (
            <div className="p-3 bg-[#F6F6F4] text-[#15803D] rounded-[8px] border border-[#E6E6E6] text-[15px] font-semibold">
              {usedOnBillMessage}
            </div>
          )}

          {/* Result Status Card */}
          {searched && checkedVoucher && (
            <div className="bg-[#F6F6F4] p-4 rounded-[8px] border border-[#E6E6E6] flex flex-col gap-3 mt-2">
              <div className="font-mono font-bold text-[18px] text-[#1A1A1A]">
                {checkedVoucher.code}
              </div>

              {/* Green: Valid */}
              {checkedVoucher.status === 'VALID' && (
                <div className="flex flex-col gap-3">
                  <div className="text-[#15803D] font-bold text-[18px]">
                    {STRINGS.voucherValid.replace('{amount}', String(checkedVoucher.face_value))}
                  </div>
                  <div className="text-[#6B6B6B] text-[15px]">
                    Valid for in-store shopping on purchase of Rs 3,000 or more.
                  </div>
                  <Button type="button" variant="primary" fullWidth onClick={handleUseOnBill}>
                    {STRINGS.useOnBillBtn}
                  </Button>
                </div>
              )}

              {/* Amber: Already used */}
              {checkedVoucher.status === 'USED' && (
                <div className="text-[#B45309] font-bold text-[17px]">
                  {STRINGS.voucherUsed.replace('{date}', checkedVoucher.used_at || 'earlier')}
                </div>
              )}

              {/* Red: Expired */}
              {checkedVoucher.status === 'EXPIRED' && (
                <div className="text-[#B91C1C] font-bold text-[17px]">
                  {STRINGS.voucherExpired}
                </div>
              )}

              {/* Red: Not found */}
              {checkedVoucher.status === 'NOT_FOUND' && (
                <div className="text-[#B91C1C] font-bold text-[17px]">
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
