'use client';

import React from 'react';
import { formatRupees } from '@/lib/strings';

export interface ItemRowProps {
  itemNumber: string;
  name: string;
  price: number;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function ItemRow({
  itemNumber,
  name,
  price,
  quantity,
  onIncrement,
  onDecrement,
  onRemove,
}: ItemRowProps) {
  const lineTotal = price * quantity;

  return (
    <div className="py-3 border-b border-[#E6E6E6] flex flex-col gap-2 w-full min-w-0">
      {/* Top line: Name and item number on left, price on right */}
      <div className="flex items-baseline justify-between gap-2 w-full min-w-0">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[#1A1A1A] text-[17px] inline-block mr-2">{name}</span>
          {itemNumber ? <span className="text-[#6B6B6B] text-[15px] whitespace-nowrap">#{itemNumber}</span> : null}
        </div>
        <div className="font-bold text-[#1A1A1A] text-[17px] whitespace-nowrap text-right shrink-0">
          {formatRupees(lineTotal)}
        </div>
      </div>

      {/* Bottom line: Quantity stepper below, plain "Remove" text button */}
      <div className="flex items-center justify-between pt-1 w-full">
        <div className="flex items-center border border-[#E6E6E6] rounded-[8px] bg-[#F6F6F4]">
          <button
            type="button"
            onClick={onDecrement}
            className="w-12 h-10 flex items-center justify-center text-[#1A1A1A] font-bold text-[18px] hover:bg-[#EAEAE6] rounded-l-[8px]"
            aria-label="Decrease quantity"
          >
            –
          </button>
          <span className="w-10 text-center font-bold text-[17px] text-[#1A1A1A]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={onIncrement}
            className="w-12 h-10 flex items-center justify-center text-[#1A1A1A] font-bold text-[18px] hover:bg-[#EAEAE6] rounded-r-[8px]"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-[#6B6B6B] hover:text-[#B91C1C] text-[15px] font-medium px-2 py-1"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
