'use client';

import React, { useEffect, useState } from 'react';
import { STRINGS } from '@/lib/strings';

export function StatusBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      className={`w-full py-1.5 px-4 text-center text-[15px] font-medium border-b border-[#E6E6E6] ${
        isOnline ? 'bg-[#F6F6F4] text-[#6B6B6B]' : 'bg-[#FEF3C7] text-[#B45309]'
      }`}
    >
      {isOnline ? STRINGS.online : STRINGS.offline}
    </div>
  );
}
