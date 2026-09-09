'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Download, RefreshCw, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { formatBytes, formatSpeed } from '@/lib/utils/format';

interface CompleteScreenProps {
  mode: 'sender' | 'receiver';
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  averageSpeed: number;
  sha256: string;
  originalSha256?: string;
  verified?: boolean;
  blob?: Blob;
  onReset: () => void;
}

export function CompleteScreen({
  mode,
  fileName,
  fileSize,
  durationSeconds,
  averageSpeed,
  sha256,
  originalSha256,
  verified = true,
  blob,
  onReset
}: CompleteScreenProps) {
  const [showHash, setShowHash] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const isSender = mode === 'sender';

  useEffect(() => {
    if (verified) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    }
  }, [verified]);

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {}
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/[0.04] flex flex-col items-center gap-6">
      {/* Success Icon */}
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
          verified
            ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
        }`}
      >
        {verified ? <CheckCircle2 className="w-9 h-9" /> : <AlertTriangle className="w-9 h-9" />}
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
          {isSender ? 'Transfer Complete' : 'File Received'}
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {verified
            ? 'Transferred directly via local WebRTC DataChannel'
            : 'Transfer ended, but SHA-256 verification failed'}
        </p>
      </div>

      {/* File Info Card */}
      <div className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/50 flex items-center justify-between">
        <div className="overflow-hidden pr-3">
          <p className="font-semibold text-sm text-neutral-900 dark:text-white truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
            {formatBytes(fileSize)}
          </p>
        </div>
        <div className="text-right flex-shrink-0 font-mono">
          <span className="text-xs text-neutral-400 block">Duration</span>
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {durationSeconds.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="w-full grid grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/40 dark:border-neutral-700/40 text-center">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block font-medium">Average Speed</span>
          <span className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">
            {formatSpeed(averageSpeed)}
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/40 dark:border-neutral-700/40 text-center">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block font-medium">Integrity</span>
          <span className={`text-xs font-semibold font-mono ${verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {verified ? 'SHA-256 Verified' : 'Hash Mismatch'}
          </span>
        </div>
      </div>

      {/* Verification Details Accordion */}
      <div className="w-full">
        <button
          onClick={() => setShowHash(!showHash)}
          className="w-full flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 p-2 rounded-xl transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cryptographic Checksum Details</span>
          </div>
          {showHash ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showHash && (
          <div className="mt-2 p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] flex flex-col gap-2">
            <div>
              <div className="flex items-center justify-between text-neutral-500">
                <span>SHA-256:</span>
                <button onClick={copyHash} className="hover:text-neutral-800 dark:hover:text-neutral-200">
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="break-all text-neutral-800 dark:text-neutral-200 mt-0.5">{sha256}</p>
            </div>
            {originalSha256 && (
              <div>
                <span className="text-neutral-500">Sender SHA-256:</span>
                <p className="break-all text-neutral-800 dark:text-neutral-200 mt-0.5">{originalSha256}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary Actions */}
      <div className="w-full flex flex-col gap-3">
        {!isSender && blob && (
          <button
            onClick={handleDownload}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all duration-200 active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Save / Download File</span>
          </button>
        )}

        <button
          onClick={onReset}
          className={`w-full py-3.5 px-6 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            isSender
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]'
              : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>{isSender ? 'Send Another File' : 'Receive Another File'}</span>
        </button>
      </div>
    </div>
  );
}
