'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Zap, WifiOff, Smartphone } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-8 text-center py-6">
      {/* Hero Title */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-2"
      >
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          ShareFast
        </h1>
        <p className="text-base sm:text-lg text-neutral-500 dark:text-neutral-400 font-normal">
          Transfer files directly between nearby devices.
        </p>
      </motion.div>

      {/* Main Action Cards */}
      <div className="w-full flex flex-col gap-4">
        {/* SEND CARD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Link
            href="/send"
            className="group relative block w-full p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 hover:border-blue-500/50 dark:hover:border-blue-500/50 hover:bg-neutral-50/80 dark:hover:bg-neutral-850/80 backdrop-blur-2xl shadow-xl shadow-black/[0.03] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-left">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300">
                  <ArrowUpRight className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    SEND FILE
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Generate instant QR code & one-time pairing code
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all">
                →
              </div>
            </div>
          </Link>
        </motion.div>

        {/* RECEIVE CARD */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Link
            href="/receive"
            className="group relative block w-full p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:bg-neutral-50/80 dark:hover:bg-neutral-850/80 backdrop-blur-2xl shadow-xl shadow-black/[0.03] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-left">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-300">
                  <ArrowDownLeft className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    RECEIVE FILE
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Scan sender QR code or enter 6-digit PIN
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all">
                →
              </div>
            </div>
          </Link>
        </motion.div>
      </div>

      {/* Feature Badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full pt-4"
      >
        <div className="p-3 rounded-2xl bg-neutral-100/60 dark:bg-neutral-900/50 border border-neutral-200/50 dark:border-neutral-800/50 flex flex-col items-center gap-1">
          <WifiOff className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">No Cloud</span>
        </div>
        <div className="p-3 rounded-2xl bg-neutral-100/60 dark:bg-neutral-900/50 border border-neutral-200/50 dark:border-neutral-800/50 flex flex-col items-center gap-1">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">Direct P2P</span>
        </div>
        <div className="p-3 rounded-2xl bg-neutral-100/60 dark:bg-neutral-900/50 border border-neutral-200/50 dark:border-neutral-800/50 flex flex-col items-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">SHA-256 Hash</span>
        </div>
        <div className="p-3 rounded-2xl bg-neutral-100/60 dark:bg-neutral-900/50 border border-neutral-200/50 dark:border-neutral-800/50 flex flex-col items-center gap-1">
          <Smartphone className="w-4 h-4 text-blue-500" />
          <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">AirDrop Feel</span>
        </div>
      </motion.div>
    </div>
  );
}
