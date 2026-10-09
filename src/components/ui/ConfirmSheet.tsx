'use client';

import React from 'react';
import { Button } from './Button';

export interface ConfirmSheetProps {
  isOpen: boolean;
  title: string;
  itemsSummary: { label: string; value: string }[];
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export function ConfirmSheet({
  isOpen,
  title,
  itemsSummary,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isDangerous = false,
}: ConfirmSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white border border-[#E6E6E6] rounded-t-[12px] sm:rounded-[8px] p-6 flex flex-col gap-5">
        <h2 className="text-[20px] font-bold text-[#1A1A1A]">{title}</h2>

        {/* Plain Summary Panel */}
        <div className="bg-[#F6F6F4] p-4 rounded-[8px] border border-[#E6E6E6] flex flex-col gap-2.5 text-[17px]">
          {itemsSummary.map((item, idx) => (
            <div key={idx} className="flex justify-between items-baseline">
              <span className="text-[#6B6B6B]">{item.label}</span>
              <span className="font-semibold text-[#1A1A1A]">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Buttons (spaced >= 12px) */}
        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="button"
            variant={isDangerous ? 'danger' : 'primary'}
            fullWidth
            onClick={onConfirm}
          >
            {confirmText}
          </Button>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onCancel}
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </div>
  );
}
