'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Activity, Clock, Database, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatBytes, formatSpeed, formatDuration } from '@/lib/utils/format';
import { TransferStats } from '@sharefast/protocol';

interface TransferProgressProps {
  mode: 'sending' | 'receiving';
  fileName: string;
  fileSize: number;
  stats: TransferStats;
  onCancel: () => void;
}

export function TransferProgress({
  mode,
  fileName,
  fileSize,
  stats,
  onCancel
}: TransferProgressProps) {
  const isSending = mode === 'sending';

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/[0.04] flex flex-col gap-6">
      {/* Header status pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isSending
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isSending ? <ArrowUpRight className="w-4 h-4 animate-pulse" /> : <ArrowDownLeft className="w-4 h-4 animate-pulse" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {isSending ? 'Sending File...' : 'Receiving File...'}
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Direct WebRTC DataChannel
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60">
          {stats.percentage.toFixed(0)}%
        </span>
      </div>

      {/* File Info Card */}
      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/50">
        <p className="font-semibold text-base text-neutral-900 dark:text-white truncate" title={fileName}>
          {fileName}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1">
          {formatBytes(fileSize)}
        </p>
      </div>

      {/* Animated Progress Bar */}
      <div className="flex flex-col gap-2">
        <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden p-0.5 border border-neutral-200/40 dark:border-neutral-700/40">
          <motion.div
            className={`h-full rounded-full ${
              isSending
                ? 'bg-gradient-to-r from-blue-600 to-indigo-500'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(1, stats.percentage))}%` }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono">
          <span>{formatBytes(stats.bytesTransferred)}</span>
          <span>{formatBytes(fileSize)}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Transfer Speed */}
        <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/40 dark:border-neutral-700/40 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">Speed</p>
            <p className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">
              {formatSpeed(stats.currentSpeed)}
            </p>
          </div>
        </div>

        {/* Time Remaining */}
        <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/40 dark:border-neutral-700/40 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">Remaining</p>
            <p className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">
              {formatDuration(stats.etaSeconds)}
            </p>
          </div>
        </div>
      </div>

      {/* Security badge */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>End-to-End P2P Encrypted • Zero Server Relay</span>
      </div>

      {/* Cancel Action */}
      <button
        onClick={onCancel}
        className="w-full py-3 px-4 rounded-2xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
      >
        <X className="w-4 h-4" />
        <span>Cancel Transfer</span>
      </button>
    </div>
  );
}
