'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Clock, Radio, X, ExternalLink } from 'lucide-react';
import { formatDuration } from '@/lib/utils/format';

interface QRDisplayProps {
  sessionId: string;
  token: string;
  otp: string;
  expiresAt: number;
  fileName: string;
  fileSizeFormatted: string;
  onCancel: () => void;
}

export function QRDisplay({
  sessionId,
  token,
  otp,
  expiresAt,
  fileName,
  fileSizeFormatted,
  onCancel
}: QRDisplayProps) {
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  );

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/receive?s=${encodeURIComponent(sessionId)}&t=${encodeURIComponent(token)}`
      : '';

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const copyToClipboard = async (text: string, type: 'otp' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'otp') {
        setCopiedOtp(true);
        setTimeout(() => setCopiedOtp(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  // Format OTP as "482 913"
  const formattedOtp = otp.length === 6 ? `${otp.slice(0, 3)} ${otp.slice(3)}` : otp;

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/[0.04] flex flex-col items-center gap-6">
      {/* File summary pill */}
      <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/40">
        <div className="overflow-hidden pr-3">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
            {fileSizeFormatted}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0 bg-white dark:bg-neutral-900 px-2.5 py-1 rounded-xl border border-neutral-200/40 dark:border-neutral-700/40">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>{formatDuration(remainingSeconds)}</span>
        </div>
      </div>

      {/* QR Code Container */}
      <div className="p-4 rounded-3xl bg-white shadow-xl shadow-blue-500/5 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center">
        {shareUrl ? (
          <QRCodeSVG
            value={shareUrl}
            size={200}
            level="M"
            includeMargin={false}
            className="w-48 h-48 sm:w-52 sm:h-52"
          />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center text-neutral-400 text-xs">
            Loading QR...
          </div>
        )}
      </div>

      {/* One-Time Code / OTP */}
      <div className="w-full flex flex-col items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          One-Time Pairing Code
        </span>
        <div className="flex items-center gap-3">
          <div className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-neutral-900 dark:text-white px-4 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700">
            {formattedOtp}
          </div>
          <button
            onClick={() => copyToClipboard(otp, 'otp')}
            className="p-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors border border-neutral-200 dark:border-neutral-700"
            title="Copy pairing code"
          >
            {copiedOtp ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Waiting Radar Status */}
      <div className="flex items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-400 bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full border border-blue-500/20">
        <Radio className="w-4 h-4 animate-pulse text-blue-500" />
        <span>Waiting for receiver to scan or enter code...</span>
      </div>

      {/* Actions */}
      <div className="w-full flex items-center gap-3 pt-2">
        <button
          onClick={() => copyToClipboard(shareUrl, 'link')}
          className="flex-1 py-3 px-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ExternalLink className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Share Link'}</span>
        </button>

        <button
          onClick={onCancel}
          className="py-3 px-4 rounded-2xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}
