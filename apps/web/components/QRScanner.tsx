'use client';

import { useState, useEffect, useRef } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Camera, RefreshCw, AlertCircle, Zap, ZapOff } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (data: { sessionId?: string; token?: string; otp?: string }) => void;
  onError?: (err: string) => void;
}

export function QRScanner({ onScanSuccess, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);

  // Initialize camera list
  useEffect(() => {
    async function initCameras() {
      try {
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        setCameras(devices);
        if (devices.length > 0) {
          // Prefer back/environment camera for phones
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.deviceId : devices[0].deviceId);
        } else {
          setErrorMessage('No camera found on this device.');
          setHasPermission(false);
        }
      } catch (err: any) {
        console.error('[QRScanner] Device enumeration error:', err);
        setErrorMessage('Camera permission denied or camera not accessible.');
        setHasPermission(false);
      }
    }
    initCameras();
  }, []);

  // Start scanner when camera selected
  useEffect(() => {
    if (!selectedCameraId || !videoRef.current) return;

    let isMounted = true;
    const codeReader = new BrowserQRCodeReader();

    async function startScanning() {
      try {
        setErrorMessage(null);
        if (controlsRef.current) {
          controlsRef.current.stop();
          controlsRef.current = null;
        }

        const controls = await codeReader.decodeFromVideoDevice(
          selectedCameraId,
          videoRef.current!,
          (result, error) => {
            if (!isMounted) return;
            if (result) {
              const text = result.getText();
              handleScannedText(text);
            }
          }
        );

        if (isMounted) {
          controlsRef.current = controls;
          setHasPermission(true);

          // Check torch capability
          try {
            const stream = videoRef.current?.srcObject as MediaStream;
            const track = stream?.getVideoTracks()[0];
            const capabilities = (track?.getCapabilities?.() as any) || {};
            setSupportsTorch(!!capabilities.torch);
          } catch {}
        } else {
          controls.stop();
        }
      } catch (err: any) {
        console.error('[QRScanner] Start scan error:', err);
        if (isMounted) {
          setHasPermission(false);
          setErrorMessage(
            err.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access in your browser settings.'
              : 'Unable to start camera stream.'
          );
          onError?.(err.message);
        }
      }
    }

    startScanning();

    return () => {
      isMounted = false;
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [selectedCameraId]);

  const toggleTorch = async () => {
    try {
      const stream = videoRef.current?.srcObject as MediaStream;
      const track = stream?.getVideoTracks()[0];
      if (track) {
        const next = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: next }]
        });
        setTorchEnabled(next);
      }
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  const handleScannedText = (text: string) => {
    console.log('[QRScanner] Scanned text:', text);
    try {
      // 1. Check if URL contains query params
      if (text.includes('?')) {
        const url = new URL(text);
        const sessionId = url.searchParams.get('s') || undefined;
        const token = url.searchParams.get('t') || undefined;
        const otp = url.searchParams.get('code') || undefined;
        if (sessionId || otp) {
          if (controlsRef.current) controlsRef.current.stop();
          onScanSuccess({ sessionId, token, otp });
          return;
        }
      }

      // 2. Check if JSON payload
      if (text.startsWith('{') && text.endsWith('}')) {
        const json = JSON.parse(text);
        if (controlsRef.current) controlsRef.current.stop();
        onScanSuccess({
          sessionId: json.sessionId || json.s,
          token: json.token || json.t,
          otp: json.otp || json.code
        });
        return;
      }

      // 3. Raw 6-digit OTP
      const cleanDigits = text.replace(/\D/g, '');
      if (cleanDigits.length === 6) {
        if (controlsRef.current) controlsRef.current.stop();
        onScanSuccess({ otp: cleanDigits });
        return;
      }

      // Fallback: treated as session ID
      if (controlsRef.current) controlsRef.current.stop();
      onScanSuccess({ sessionId: text.trim() });
    } catch (err) {
      console.error('[QRScanner] Error parsing scanned payload:', err);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
      <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black border-2 border-neutral-200 dark:border-neutral-800 shadow-2xl">
        {/* Video stream */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Viewfinder Overlay & Scanning Reticle */}
        {hasPermission && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark vignette borders */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Clear target window */}
            <div className="relative w-64 h-64 border-2 border-white/60 rounded-3xl overflow-hidden bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner accents */}
              <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

              {/* Animated laser line */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_8px_#3b82f6] animate-reticle-scan" />
            </div>
          </div>
        )}

        {/* Error / Permission Denied Overlay */}
        {errorMessage && (
          <div className="absolute inset-0 bg-neutral-900/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center gap-3 text-white">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-semibold">{errorMessage}</p>
            <p className="text-xs text-neutral-400">
              You can also connect using the 6-digit OTP code below.
            </p>
          </div>
        )}

        {/* Camera controls toolbar */}
        {hasPermission && (
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {supportsTorch && (
              <button
                onClick={toggleTorch}
                className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                title={torchEnabled ? 'Turn off light' : 'Turn on light'}
              >
                {torchEnabled ? <ZapOff className="w-4 h-4 text-amber-400" /> : <Zap className="w-4 h-4" />}
              </button>
            )}

            {cameras.length > 1 && (
              <button
                onClick={() => {
                  const currentIndex = cameras.findIndex((c) => c.deviceId === selectedCameraId);
                  const nextIndex = (currentIndex + 1) % cameras.length;
                  setSelectedCameraId(cameras[nextIndex].deviceId);
                }}
                className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                title="Switch camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
        Point your camera at the QR code on the sender&apos;s screen
      </p>
    </div>
  );
}
