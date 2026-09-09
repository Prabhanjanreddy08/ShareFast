/**
 * High-Speed File Receiver
 * Listens on WebRTC DataChannel, unpacks binary frames, handles chunk reassembly,
 * computes progressive incremental SHA-256, and verifies file integrity.
 */

import { FileMetadata, TransferStats } from '@sharefast/protocol';
import { unpackBinaryChunk, IncrementalSha256 } from '@sharefast/crypto';

export interface ReceiverCallbacks {
  onMetadata: (metadata: FileMetadata) => void;
  onProgress: (stats: TransferStats) => void;
  onComplete: (result: {
    blob: Blob;
    metadata: FileMetadata;
    verified: boolean;
    durationSeconds: number;
    averageSpeed: number;
    sha256: string;
    originalSha256: string;
  }) => void;
  onError: (err: Error) => void;
  onCancelled: (reason: string) => void;
}

export class FileReceiver {
  private dataChannel: RTCDataChannel;
  private callbacks: ReceiverCallbacks;
  private metadata: FileMetadata | null = null;
  private receivedChunks: Uint8Array[] = [];
  private hasher = new IncrementalSha256();
  private totalBytesReceived = 0;
  private startTime = 0;
  private lastProgressTime = 0;
  private lastBytesReceived = 0;
  private rollingSpeed = 0;
  private isCancelled = false;

  constructor(dataChannel: RTCDataChannel, callbacks: ReceiverCallbacks) {
    this.dataChannel = dataChannel;
    this.callbacks = callbacks;
    this.initDataChannel();
  }

  private initDataChannel() {
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onmessage = (event: MessageEvent) => {
      if (this.isCancelled) return;

      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          this.handleControlMessage(msg);
        } catch (err) {
          console.error('[Receiver] Error parsing control message:', err);
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryChunk(event.data);
      }
    };

    this.dataChannel.onerror = (err) => {
      console.error('[Receiver] DataChannel error:', err);
      this.callbacks.onError(new Error('Data channel connection error'));
    };

    this.dataChannel.onclose = () => {
      console.log('[Receiver] DataChannel closed');
    };
  }

  private handleControlMessage(msg: any) {
    switch (msg.type) {
      case 'FILE_METADATA': {
        this.metadata = msg.metadata;
        this.receivedChunks = new Array(this.metadata!.totalChunks);
        this.startTime = performance.now();
        this.lastProgressTime = this.startTime;
        this.totalBytesReceived = 0;
        this.lastBytesReceived = 0;
        this.hasher = new IncrementalSha256();
        console.log(`[Receiver] Metadata received: ${this.metadata!.name} (${this.metadata!.size} bytes)`);
        this.callbacks.onMetadata(this.metadata!);
        break;
      }

      case 'TRANSFER_CANCEL': {
        this.isCancelled = true;
        this.callbacks.onCancelled('Sender cancelled the transfer');
        break;
      }

      case 'TRANSFER_COMPLETE': {
        const originalSha256 = msg.sha256;
        this.finalizeTransfer(originalSha256);
        break;
      }
    }
  }

  private handleBinaryChunk(buffer: ArrayBuffer) {
    if (!this.metadata) {
      console.warn('[Receiver] Received binary chunk before metadata');
      return;
    }

    const { chunkIndex, payload } = unpackBinaryChunk(buffer);

    // Store chunk payload
    this.receivedChunks[chunkIndex] = payload;
    this.totalBytesReceived += payload.byteLength;

    // Update incremental hash
    this.hasher.update(payload);

    // Calculate progress & rolling speed
    const now = performance.now();
    const interval = (now - this.lastProgressTime) / 1000;
    const isFinished = chunkIndex === this.metadata.totalChunks - 1;

    if (interval >= 0.15 || isFinished) {
      const instantSpeed = (this.totalBytesReceived - this.lastBytesReceived) / interval;
      this.rollingSpeed = this.rollingSpeed === 0 ? instantSpeed : this.rollingSpeed * 0.7 + instantSpeed * 0.3;
      const totalElapsed = (now - this.startTime) / 1000;
      const avgSpeed = this.totalBytesReceived / (totalElapsed || 0.001);
      const remainingBytes = Math.max(0, this.metadata.size - this.totalBytesReceived);
      const etaSeconds = this.rollingSpeed > 0 ? remainingBytes / this.rollingSpeed : 0;
      const percentage = Math.min(100, (this.totalBytesReceived / (this.metadata.size || 1)) * 100);

      this.callbacks.onProgress({
        bytesTransferred: this.totalBytesReceived,
        totalBytes: this.metadata.size,
        percentage,
        currentSpeed: this.rollingSpeed,
        averageSpeed: avgSpeed,
        etaSeconds,
        elapsedSeconds: totalElapsed
      });

      this.lastProgressTime = now;
      this.lastBytesReceived = this.totalBytesReceived;
    }
  }

  private finalizeTransfer(originalSha256: string) {
    if (!this.metadata) return;

    const receivedSha256 = this.hasher.digest();
    const verified = originalSha256.toLowerCase() === receivedSha256.toLowerCase();
    const totalDuration = (performance.now() - this.startTime) / 1000;
    const averageSpeed = this.metadata.size / (totalDuration || 0.001);

    console.log(`[Receiver] Transfer complete. Original SHA: ${originalSha256}, Received SHA: ${receivedSha256}, Verified: ${verified}`);

    // Create file Blob from chunks
    const blob = new Blob(this.receivedChunks, { type: this.metadata.mimeType });

    // Send ACK back to sender
    try {
      this.dataChannel.send(
        JSON.stringify({
          type: 'HASH_VERIFIED',
          transferId: this.metadata.transferId,
          success: verified,
          originalHash: originalSha256,
          receivedHash: receivedSha256
        })
      );
    } catch (e) {
      console.warn('[Receiver] Could not send HASH_VERIFIED ack:', e);
    }

    this.callbacks.onComplete({
      blob,
      metadata: this.metadata,
      verified,
      durationSeconds: totalDuration,
      averageSpeed,
      sha256: receivedSha256,
      originalSha256
    });
  }

  public cancel() {
    this.isCancelled = true;
    try {
      this.dataChannel.send(
        JSON.stringify({
          type: 'TRANSFER_CANCEL',
          transferId: this.metadata?.transferId || ''
        })
      );
    } catch {}
  }
}
