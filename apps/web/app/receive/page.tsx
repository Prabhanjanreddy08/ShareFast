'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignalingClient } from '@/lib/signaling/client';
import { WebRTCPeer } from '@/lib/webrtc/peer';
import { FileReceiver } from '@/lib/transfer/receiver';
import { QRScanner } from '@/components/QRScanner';
import { OTPInput } from '@/components/OTPInput';
import { TransferProgress } from '@/components/TransferProgress';
import { CompleteScreen } from '@/components/CompleteScreen';
import { FileMetadata, TransferStats } from '@sharefast/protocol';
import { QrCode, KeyRound, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

type ReceiveState = 'PAIRING' | 'CONNECTING' | 'RECEIVING' | 'COMPLETED' | 'ERROR';

function ReceiveContent() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get('s');
  const urlToken = searchParams.get('t');

  const [activeTab, setActiveTab] = useState<'qr' | 'otp'>('qr');
  const [state, setState] = useState<ReceiveState>('PAIRING');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [transferStats, setTransferStats] = useState<TransferStats>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    currentSpeed: 0,
    averageSpeed: 0,
    etaSeconds: 0,
    elapsedSeconds: 0
  });

  const [completionResult, setCompletionResult] = useState<{
    blob: Blob;
    metadata: FileMetadata;
    verified: boolean;
    durationSeconds: number;
    averageSpeed: number;
    sha256: string;
    originalSha256: string;
  } | null>(null);

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const receiverRef = useRef<FileReceiver | null>(null);

  const cleanup = () => {
    if (receiverRef.current) {
      receiverRef.current.cancel();
      receiverRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (signalingRef.current) {
      signalingRef.current.disconnect();
      signalingRef.current = null;
    }
  };

  useEffect(() => {
    // If URL has query parameters from QR code deep-link, auto-join immediately!
    if (urlSessionId && urlToken) {
      handlePair({ sessionId: urlSessionId, token: urlToken });
    }
    return () => {
      cleanup();
    };
  }, [urlSessionId, urlToken]);

  const handlePair = async (params: { sessionId?: string; token?: string; otp?: string }) => {
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      const signaling = new SignalingClient();
      signalingRef.current = signaling;

      await signaling.connect();

      // Join session
      const joined = await signaling.joinSession(params);
      console.log('[Receiver] Successfully joined session:', joined.sessionId, joined.fileMeta);

      setState('CONNECTING');
      await establishWebRTC(joined.sessionId, signaling);
    } catch (err: any) {
      console.error('[Receiver] Pair error:', err);
      setIsConnecting(false);
      setErrorMessage(err.message || 'Failed to connect with sender.');
      if (params.otp) {
        setActiveTab('otp');
      }
    }
  };

  const establishWebRTC = async (sessionId: string, signaling: SignalingClient) => {
    try {
      const peer = new WebRTCPeer({
        onIceCandidate: (candidate) => {
          signaling.sendIceCandidate(sessionId, candidate);
        },
        onDataChannel: (dataChannel) => {
          console.log('[Receiver] DataChannel received! Attaching file receiver engine...');
          attachReceiverEngine(dataChannel);
        },
        onConnectionStateChange: (connState) => {
          console.log('[Receiver] WebRTC peer state:', connState);
          if (connState === 'failed' || connState === 'disconnected') {
            setErrorMessage('Direct P2P connection lost');
            setState('ERROR');
          }
        }
      });
      peerRef.current = peer;

      // Handle SDP Offer from sender
      signaling.on('offer', async (offerSdp) => {
        console.log('[Receiver] Received SDP Offer from sender. Creating answer...');
        const answer = await peer.createAnswer(offerSdp);
        signaling.sendAnswer(sessionId, answer);
      });

      // Handle ICE Candidates from sender
      signaling.on('iceCandidate', async (candidate) => {
        await peer.addIceCandidate(candidate);
      });

      signaling.on('sessionCancelled', (reason) => {
        setErrorMessage(reason);
        setState('ERROR');
      });

      signaling.on('peerDisconnected', (reason) => {
        if (state === 'RECEIVING') {
          setErrorMessage('Sender disconnected before transfer finished.');
          setState('ERROR');
        }
      });
    } catch (err: any) {
      console.error('[Receiver] WebRTC setup error:', err);
      setErrorMessage(err.message || 'Failed to establish peer connection.');
      setState('ERROR');
    }
  };

  const attachReceiverEngine = (dataChannel: RTCDataChannel) => {
    const receiver = new FileReceiver(dataChannel, {
      onMetadata: (metadata) => {
        console.log('[Receiver] File metadata confirmed, displaying receiving progress...');
        setFileMetadata(metadata);
        setState('RECEIVING');
      },
      onProgress: (stats) => {
        setTransferStats(stats);
      },
      onComplete: (result) => {
        console.log('[Receiver] File received and verified successfully!');
        setCompletionResult(result);
        setState('COMPLETED');
      },
      onError: (err) => {
        setErrorMessage(err.message);
        setState('ERROR');
      },
      onCancelled: (reason) => {
        setErrorMessage(reason);
        setState('ERROR');
      }
    });

    receiverRef.current = receiver;
  };

  const handleCancel = () => {
    cleanup();
    handleReset();
  };

  const handleReset = () => {
    cleanup();
    setFileMetadata(null);
    setCompletionResult(null);
    setErrorMessage(null);
    setIsConnecting(false);
    setState('PAIRING');
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-4">
      {/* Back button on initial pairing */}
      {state === 'PAIRING' && (
        <div className="w-full max-w-sm mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to home</span>
          </Link>
        </div>
      )}

      {/* State 1: Pairing (Scan QR or Enter OTP) */}
      {state === 'PAIRING' && (
        <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Receive File</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Scan the sender&apos;s QR code or enter the 6-digit PIN
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="w-full grid grid-cols-2 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/50 dark:border-neutral-700/50">
            <button
              onClick={() => {
                setActiveTab('qr');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'qr'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('otp');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'otp'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Enter Code</span>
            </button>
          </div>

          {/* Active Tab View */}
          {activeTab === 'qr' ? (
            <QRScanner
              onScanSuccess={(data) => handlePair(data)}
              onError={(err) => setErrorMessage(err)}
            />
          ) : (
            <div className="w-full flex flex-col items-center gap-4">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Enter the 6-digit code shown on the sender&apos;s screen:
              </span>
              <OTPInput
                onComplete={(otp) => handlePair({ otp })}
                isLoading={isConnecting}
                errorMessage={errorMessage}
              />
            </div>
          )}

          {activeTab === 'qr' && errorMessage && (
            <div className="w-full flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* State 2: Connecting */}
      {state === 'CONNECTING' && (
        <div className="w-full max-w-md mx-auto rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-8 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Connecting to Sender...</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Establishing direct peer-to-peer data channel...
          </p>
        </div>
      )}

      {/* State 3: Receiving Progress */}
      {state === 'RECEIVING' && fileMetadata && (
        <TransferProgress
          mode="receiving"
          fileName={fileMetadata.name}
          fileSize={fileMetadata.size}
          stats={transferStats}
          onCancel={handleCancel}
        />
      )}

      {/* State 4: Completed */}
      {state === 'COMPLETED' && completionResult && (
        <CompleteScreen
          mode="receiver"
          fileName={completionResult.metadata.name}
          fileSize={completionResult.metadata.size}
          durationSeconds={completionResult.durationSeconds}
          averageSpeed={completionResult.averageSpeed}
          sha256={completionResult.sha256}
          originalSha256={completionResult.originalSha256}
          verified={completionResult.verified}
          blob={completionResult.blob}
          onReset={handleReset}
        />
      )}

      {/* State 5: Error */}
      {state === 'ERROR' && (
        <div className="w-full max-w-md mx-auto rounded-3xl border border-rose-200 dark:border-rose-900/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-8 flex flex-col items-center gap-4 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Transfer Interrupted</h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {errorMessage || 'The connection to the sender was lost.'}
          </p>
          <button
            onClick={handleReset}
            className="w-full py-3 px-6 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs transition-transform active:scale-[0.98] mt-2"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReceivePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      }
    >
      <ReceiveContent />
    </Suspense>
  );
}
