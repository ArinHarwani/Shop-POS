'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Package, Ticket, BarChart3, Users, Wifi, WifiOff, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { getActiveRole, setActiveRole, getCachedCatalogue, setCachedCatalogue } from '@/lib/storage';
import { DataService } from '@/lib/data-service';
import { UserRole } from '@/types';

export function Navbar() {
  const pathname = usePathname();
  const [role, setRoleState] = useState<UserRole>('owner');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cacheTime, setCacheTime] = useState<string>('Just now');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    // Role init
    setRoleState(getActiveRole());

    // Online / Offline listeners (SYS-2)
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial cache check
    const { updatedAt } = getCachedCatalogue();
    if (updatedAt) {
      const mins = Math.floor((Date.now() - updatedAt) / 60000);
      setCacheTime(mins === 0 ? 'Just now' : `${mins}m ago`);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleRole = () => {
    const nextRole: UserRole = role === 'owner' ? 'staff' : 'owner';
    setActiveRole(nextRole);
    setRoleState(nextRole);
  };

  const refreshCatalogue = async () => {
    setIsRefreshing(true);
    try {
      const prods = await DataService.getProducts();
      setCachedCatalogue(prods);
      setCacheTime('Just now');
    } finally {
      setIsRefreshing(false);
    }
  };

  const navLinks = [
    { href: '/', label: 'Billing', icon: ShoppingBag },
    { href: '/inventory', label: 'Stock & OCR', icon: Package },
    { href: '/vouchers', label: 'Vouchers', icon: Ticket },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/customers', label: 'Customers', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0b0f17]/95 backdrop-blur-md border-b border-slate-800">
      {/* Offline Alert Banner (SYS-2) */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span>Offline Mode: You are disconnected from the network. Finalize bill is disabled.</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/40">
            <span className="text-white font-black text-xl tracking-tighter">F</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-rose-400 transition-colors">
                FEVER
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold border border-rose-500/20">
                Trendy POS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Oct 9–11 Event Edition</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Status / Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Catalogue sync status */}
          <button
            onClick={refreshCatalogue}
            title="Refresh local product cache"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
            <span>Cached ({cacheTime})</span>
          </button>

          {/* Connection status indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Role Switcher (SYS-1 Owner / Staff) */}
          <button
            onClick={toggleRole}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              role === 'owner'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Click to toggle role (Owner has discount and stock override rights)"
          >
            {role === 'owner' ? <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
            <span>Role: <span className="capitalize">{role}</span></span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumb-friendly touch targets >= 44px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#090d16]/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1 flex justify-around items-center">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
