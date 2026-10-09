'use client';

import React from 'react';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  sideAction?: React.ReactNode;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, sideAction, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full min-w-0">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="text-[15px] font-medium text-[#1A1A1A]">
              {label}
            </label>
            {error && <span className="text-[15px] font-medium text-[#B91C1C]">{error}</span>}
          </div>
        )}

        <div className="flex items-center gap-2 w-full min-w-0">
          <input
            ref={ref}
            id={inputId}
            className={`flex-1 min-w-0 w-full min-h-[52px] px-3.5 py-2.5 bg-white text-[#1A1A1A] placeholder-[#6B6B6B] border border-[#E6E6E6] rounded-[8px] text-[17px] focus:border-[var(--accent)] transition-colors ${
              error ? 'border-[#B91C1C]' : ''
            } ${className}`}
            {...props}
          />
          {sideAction}
        </div>

        {!label && error && <span className="text-[15px] font-medium text-[#B91C1C]">{error}</span>}
      </div>
    );
  }
);
TextField.displayName = 'TextField';

export const NumberField = React.forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => {
  return <TextField ref={ref} inputMode="numeric" {...props} />;
});
NumberField.displayName = 'NumberField';
