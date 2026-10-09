'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STRINGS } from '@/lib/strings';
import { StatusBanner } from './ui/StatusBanner';
import { getActiveRole, setActiveRole } from '@/lib/storage';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<'owner' | 'staff'>('staff');

  useEffect(() => {
    setRole(getActiveRole());
  }, []);

  const handleRoleToggle = () => {
    const nextRole = role === 'owner' ? 'staff' : 'owner';
    setActiveRole(nextRole);
    setRole(nextRole);
  };

  const navItems = [
    { href: '/', label: STRINGS.navSell },
    { href: '/items', label: STRINGS.navItems },
    { href: '/vouchers', label: STRINGS.navVouchers },
    { href: '/today', label: STRINGS.navToday },
  ];

  if (role === 'owner') {
    navItems.push({ href: '/more', label: STRINGS.navMore });
  }

  const isCurrentTab = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A] flex flex-col font-sans">
      {/* Top Status Line */}
      <StatusBanner />

      {/* Main Container */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Left Sidebar on Laptops (> 900px) */}
        <aside className="hidden min-[900px]:flex flex-col w-56 border-r border-[#E6E6E6] bg-white p-4 justify-between shrink-0">
          <div className="flex flex-col gap-6">
            {/* Plain Brand Title */}
            <div className="border-b border-[#E6E6E6] pb-3">
              <div className="font-bold text-[18px] text-[#1A1A1A] leading-tight">
                {STRINGS.brandName}
              </div>
              <div className="text-[15px] text-[#6B6B6B] mt-0.5">
                {STRINGS.tagline}
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-col gap-1.5">
              {navItems.map((item) => {
                const active = isCurrentTab(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`min-h-[52px] px-4 py-3 rounded-[8px] font-semibold text-[17px] flex items-center transition-colors border ${
                      active
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-white text-[#1A1A1A] border-transparent hover:bg-[#F6F6F4]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick Role Switcher for Testing (Staff / Owner) */}
          <div className="border-t border-[#E6E6E6] pt-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleRoleToggle}
              className="text-[15px] text-[#6B6B6B] hover:text-[#1A1A1A] text-left px-2 py-1"
            >
              Role: <span className="font-semibold capitalize text-[#1A1A1A]">{role}</span> (click to toggle)
            </button>
            <Link
              href="/signin"
              className="text-[15px] text-[#6B6B6B] hover:text-[#1A1A1A] text-left px-2 py-1"
            >
              Sign out
            </Link>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col pb-20 min-[900px]:pb-0 overflow-y-auto min-w-0 w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Phone Bottom Bar (4 labelled tabs + optional More for owner) */}
      <nav className="min-[900px]:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E6E6E6] h-[64px] flex items-center justify-around z-30 px-2">
        {navItems.map((item) => {
          const active = isCurrentTab(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-h-[48px] py-1 flex items-center justify-center font-bold text-[16px] rounded-[8px] transition-colors ${
                active
                  ? 'text-[var(--accent)]'
                  : 'text-[#6B6B6B]'
              }`}
            >
              <span className={`px-2 py-1 ${active ? 'border-b-2 border-[var(--accent)]' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
