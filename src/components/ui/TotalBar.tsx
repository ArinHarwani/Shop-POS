'use client';

import React from 'react';
import { formatRupees } from '@/lib/strings';
import { Button } from './Button';

export interface TotalBarProps {
  total: number;
  label?: string;
  actionText: string;
  onAction: () => void;
  disabled?: boolean;
  secondaryAction?: React.ReactNode;
}

export function TotalBar({
  total,
  label = 'Total',
  actionText,
  onAction,
  disabled = false,
  secondaryAction,
}: TotalBarProps) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-[#E6E6E6] pt-3 pb-3 px-0 sm:px-2 flex flex-col gap-3 z-20 w-full min-w-0">
      {/* Total Display */}
      <div className="flex items-baseline justify-between w-full min-w-0">
        <span className="text-[17px] font-medium text-[#6B6B6B] shrink-0">{label}</span>
        <span className="text-[28px] sm:text-[32px] font-bold text-[#1A1A1A] leading-none shrink-0 text-right">
          {formatRupees(total)}
        </span>
      </div>

      {/* Main Full-Width Button */}
      <Button
        type="button"
        variant="primary"
        fullWidth
        disabled={disabled}
        onClick={onAction}
      >
        {actionText}
      </Button>

      {secondaryAction && <div className="mt-1">{secondaryAction}</div>}
    </div>
  );
}
