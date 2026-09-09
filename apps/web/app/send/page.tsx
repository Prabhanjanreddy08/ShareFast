'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SignalingClient } from '@/lib/signaling/client';
import { WebRTCPeer } from '@/lib/webrtc/peer';
import { FileSender } from '@/lib/transfer/sender';
import { FilePicker } from '@/components/FilePicker';
import { QRDisplay } from '@/components/QRDisplay';
import { TransferProgress } from '@/components/TransferProgress';
import { CompleteScreen } from '@/components/CompleteScreen';
import { formatBytes } from '@/lib/utils/format';
import { TransferStats } from '@sharefast/protocol';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

type SendState = 'SELECT_FILE' | 'WAITING_FOR_RECEIVER' | 'CONNECTING' | 'TRANSFERRING' | 'COMPLETED' | 'ERROR';

export default function SendPage() {
  const router = useRouter();
  const [state, setState] = useState<SendState>('SELECT_FILE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sessionData, setSessionData] = useState<{
    sessionId: string;
    token: string;
    otp: string;
    expiresAt: number;
  } | null>(null);

  const [transferStats, setTransferStats] = useState<TransferStats>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    currentSpeed: 0,
    averageSpeed: 0,
    etaSeconds: 0,
    elapsedSeconds: 0
  });

  const [completionSummary, setCompletionSummary] = useState<{
    durationSeconds: number;
    averageSpeed: number;
    sha256: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const senderRef = useRef<FileSender | null>(null);

  const cleanup = () => {
    if (senderRef.current) {
      senderRef.current.cancel();
      senderRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (signalingRef.current) {
      if (sessionData?.sessionId) {
        signalingRef.current.cancelSession(sessionData.sessionId);
      }
      signalingRef.current.disconnect();
      signalingRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [sessionData?.sessionId]);

  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);

    try {
      const signaling = new SignalingClient();
      signalingRef.current = signaling;

      await signaling.connect();

      // Create session
      const created = await signaling.createSession({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        lastModified: file.lastModified
      });

      setSessionData(created);
      setState('WAITING_FOR_RECEIVER');

      // Set up signaling event handlers
      signaling.on('receiverJoined', async () => {
        console.log('[Sender] Receiver joined! Starting WebRTC handshake...');
        setState('CONNECTING');
        await establishWebRTC(file, created.sessionId, signaling);
      });

      signaling.on('sessionCancelled', (reason) => {
        setErrorMessage(reason);
        setState('ERROR');
      });

      signaling.on('peerDisconnected', (reason) => {
        if (state === 'TRANSFERRING') {
          setErrorMessage('Receiver disconnected before transfer completed.');
          setState('ERROR');
        }
      });
    } catch (err: any) {
      console.error('[Sender] Session creation error:', err);
      setErrorMessage(err.message || 'Failed to initialize sharing session');
      setState('ERROR');
    }
  };

  const establishWebRTC = async (file: File, sessionId: string, signaling: SignalingClient) => {
    try {
      const peer = new WebRTCPeer({
        onIceCandidate: (candidate) => {
          signaling.sendIceCandidate(sessionId, candidate);
        },
        onConnectionStateChange: (connState) => {
          console.log('[Sender] WebRTC peer state:', connState);
          if (connState === 'failed' || connState === 'disconnected') {
            setErrorMessage('Direct P2P connection lost');
            setState('ERROR');
          }
        }
      });
      peerRef.current = peer;

      // Handle remote answer and ice candidates from receiver
      signaling.on('answer', async (sdp) => {
        console.log('[Sender] Received SDP Answer from receiver');
        await peer.setAnswer(sdp);
      });

      signaling.on('iceCandidate', async (candidate) => {
        await peer.addIceCandidate(candidate);
      });

      // Create DataChannel on sender side
      const dataChannel = peer.createDataChannel('sharefast-transfer');

      dataChannel.onopen = () => {
        console.log('[Sender] DataChannel is open! Commencing high-speed transfer...');
        setState('TRANSFERRING');
        startTransfer(file, dataChannel);
      };

      dataChannel.onerror = (err) => {
        console.error('[Sender] DataChannel error:', err);
        setErrorMessage('Data channel transfer error');
        setState('ERROR');
      };

      // Create and send SDP Offer to receiver
      const offer = await peer.createOffer();
      signaling.sendOffer(sessionId, offer);
    } catch (err: any) {
      console.error('[Sender] WebRTC error:', err);
      setErrorMessage(err.message || 'Failed to establish direct peer connection');
      setState('ERROR');
    }
  };

  const startTransfer = (file: File, dataChannel: RTCDataChannel) => {
    const sender = new FileSender(file, dataChannel, {
      onProgress: (stats) => {
        setTransferStats(stats);
      },
      onComplete: (summary) => {
        console.log('[Sender] File transfer successful!');
        setCompletionSummary(summary);
        setState('COMPLETED');
      },
      onError: (err) => {
        setErrorMessage(err.message);
        setState('ERROR');
      },
      onCancelled: () => {
        handleReset();
      }
    });

    senderRef.current = sender;
    sender.start();
  };

  const handleCancel = () => {
    cleanup();
    handleReset();
  };

  const handleReset = () => {
    cleanup();
    setSelectedFile(null);
    setSessionData(null);
    setCompletionSummary(null);
    setErrorMessage(null);
    setState('SELECT_FILE');
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-4">
      {/* Back button when on file select */}
      {state === 'SELECT_FILE' && (
        <div className="w-full max-w-lg mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to home</span>
          </Link>
        </div>
      )}

      {/* State 1: Select File */}
      {state === 'SELECT_FILE' && (
        <div className="w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Send File</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Select a file to transfer directly to a nearby device
            </p>
          </div>
          <FilePicker onFileSelected={handleFileSelected} />
        </div>
      )}

      {/* State 2: Waiting for Receiver (QR + OTP) */}
      {state === 'WAITING_FOR_RECEIVER' && sessionData && selectedFile && (
        <QRDisplay
          sessionId={sessionData.sessionId}
          token={sessionData.token}
          otp={sessionData.otp}
          expiresAt={sessionData.expiresAt}
          fileName={selectedFile.name}
          fileSizeFormatted={formatBytes(selectedFile.size)}
          onCancel={handleCancel}
        />
      )}

      {/* State 3: Connecting Handshake */}
      {state === 'CONNECTING' && selectedFile && (
        <div className="w-full max-w-md mx-auto rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-8 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Receiver Connected!</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Negotiating direct WebRTC DataChannel connection...
          </p>
        </div>
      )}

      {/* State 4: Transferring */}
      {state === 'TRANSFERRING' && selectedFile && (
        <TransferProgress
          mode="sending"
          fileName={selectedFile.name}
          fileSize={selectedFile.size}
          stats={transferStats}
          onCancel={handleCancel}
        />
      )}

      {/* State 5: Completed */}
      {state === 'COMPLETED' && selectedFile && completionSummary && (
        <CompleteScreen
          mode="sender"
          fileName={selectedFile.name}
          fileSize={selectedFile.size}
          durationSeconds={completionSummary.durationSeconds}
          averageSpeed={completionSummary.averageSpeed}
          sha256={completionSummary.sha256}
          verified={true}
          onReset={handleReset}
        />
      )}

      {/* State 6: Error */}
      {state === 'ERROR' && (
        <div className="w-full max-w-md mx-auto rounded-3xl border border-rose-200 dark:border-rose-900/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-8 flex flex-col items-center gap-4 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Transfer Failed</h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {errorMessage || 'An unexpected connection error occurred.'}
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
