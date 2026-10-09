'use client';

import React, { useState } from 'react';
import { STRINGS } from '@/lib/strings';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate sign in and return to Sell screen
    router.push('/');
  };

  return (
    <div className="w-full flex-1 flex justify-center items-center bg-white px-4">
      <div className="w-full max-w-[400px] flex flex-col gap-6 py-12">
        {/* Logo text "FEVER - Trendy Collection" at the top in plain text. Nothing else. */}
        <div className="text-center">
          <h1 className="text-[22px] font-bold text-[#1A1A1A] leading-tight">
            {STRINGS.brandName}
          </h1>
          <p className="text-[15px] text-[#6B6B6B] mt-1">Staff Sign In</p>
        </div>

        {/* Email, password, one button */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@fever.com"
            required
            autoFocus
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <div className="pt-2">
            <Button type="submit" variant="primary" fullWidth>
              Sign In
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
