'use client';

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { Radio, Zap } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200/60 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-950/70 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-neutral-900 dark:text-white">ShareFast</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                P2P
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 -mt-0.5">Direct device-to-device</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <Zap className="w-3.5 h-3.5" />
            <span>Zero Cloud Storage</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
