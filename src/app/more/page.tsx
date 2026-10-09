'use client';

import React, { useState } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { Button } from '@/components/ui/Button';
import { exportAllDataToCsv } from '@/lib/csv';
import { DataService } from '@/lib/data-service';

export default function MorePage() {
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExportAll = async () => {
    const data = await DataService.getAllDataForExport();
    exportAllDataToCsv(data);
    setExportNotice('Export downloaded to your device as CSV files.');
    setTimeout(() => setExportNotice(null), 3500);
  };

  return (
    <div className="w-full flex-1 flex justify-center bg-white">
      <div className="w-full max-w-[520px] flex flex-col min-h-[calc(100vh-64px)] px-4 py-4 sm:py-6">
        <div className="flex flex-col gap-5">
          <div className="pb-2 border-b border-[#E6E6E6]">
            <h1 className="text-[20px] font-bold text-[#1A1A1A]">Owner Actions</h1>
            <p className="text-[15px] text-[#6B6B6B] mt-0.5">
              Features restricted to the stall owner
            </p>
          </div>

          {exportNotice && (
            <div className="p-3 bg-[#F6F6F4] text-[#15803D] rounded-[8px] border border-[#E6E6E6] text-[15px] font-medium">
              {exportNotice}
            </div>
          )}

          {/* Action List */}
          <div className="flex flex-col divide-y divide-[#E6E6E6] border border-[#E6E6E6] rounded-[8px] overflow-hidden bg-white">
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#1A1A1A] text-[17px]">Daily CSV Export</div>
                <div className="text-[15px] text-[#6B6B6B]">Download all sales, vouchers & stock off device</div>
              </div>
              <Button type="button" variant="secondary" onClick={handleExportAll}>
                Export CSV
              </Button>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#1A1A1A] text-[17px]">Reward Offer Tiers</div>
                <div className="text-[15px] text-[#6B6B6B]">Rs 499 (gift), Rs 999 (Rs 250 voucher), Rs 1,499 (Rs 350 voucher + gift), Rs 1,999 (Rs 500 voucher)</div>
              </div>
              <span className="text-[15px] font-medium text-[#15803D]">Active</span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#1A1A1A] text-[17px]">Void / Cancel Bill</div>
                <div className="text-[15px] text-[#6B6B6B]">Restores stock and voids unredeemed vouchers</div>
              </div>
              <a href="/history" className="text-[15px] font-semibold text-[var(--accent)] underline">
                Go to Bills
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
