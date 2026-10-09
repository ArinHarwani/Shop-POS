'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  let baseStyle = 'min-h-[52px] px-5 py-3 rounded-[8px] font-semibold text-[17px] flex items-center justify-center gap-2 border transition-transform duration-100 disabled:opacity-40 disabled:cursor-not-allowed';

  if (fullWidth) {
    baseStyle += ' w-full';
  }

  if (variant === 'primary') {
    baseStyle += ' bg-[var(--accent)] text-white border-[var(--accent)] hover:opacity-95';
  } else if (variant === 'secondary') {
    baseStyle += ' bg-[#F6F6F4] text-[#1A1A1A] border-[#E6E6E6] hover:bg-[#EFEFEA]';
  } else if (variant === 'text') {
    baseStyle += ' bg-transparent text-[#6B6B6B] border-transparent hover:text-[#1A1A1A] hover:bg-[#F6F6F4] font-normal';
  } else if (variant === 'danger') {
    baseStyle += ' bg-[#B91C1C] text-white border-[#B91C1C] hover:opacity-95';
  }

  return (
    <button disabled={disabled} className={`${baseStyle} ${className}`} {...props}>
      {children}
    </button>
  );
}
