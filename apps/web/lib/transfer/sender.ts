/**
 * High-Speed File Sender
 * Uses WebRTC DataChannel with binary chunk framing, backpressure flow control,
 * incremental streaming SHA-256 calculation, and rolling average speed monitoring.
 */

import { PROTOCOL_CONSTANTS, FileMetadata, TransferStats } from '@sharefast/protocol';
import { packBinaryChunk, stringHash32, IncrementalSha256 } from '@sharefast/crypto';

export interface SenderCallbacks {
  onProgress: (stats: TransferStats) => void;
  onComplete: (summary: { durationSeconds: number; averageSpeed: number; sha256: string }) => void;
  onError: (err: Error) => void;
  onCancelled: () => void;
}

export class FileSender {
  private file: File;
  private dataChannel: RTCDataChannel;
  private callbacks: SenderCallbacks;
  private isCancelled = false;
  private isPaused = false;
  private transferId: string;

  constructor(file: File, dataChannel: RTCDataChannel, callbacks: SenderCallbacks) {
    this.file = file;
    this.dataChannel = dataChannel;
    this.callbacks = callbacks;
    this.transferId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  public async start(): Promise<void> {
    const chunkSize = PROTOCOL_CONSTANTS.CHUNK_SIZE;
    const totalChunks = Math.ceil(this.file.size / chunkSize);
    const transferIdHash = stringHash32(this.transferId);
    const hasher = new IncrementalSha256();

    // Configure low watermark on DataChannel for backpressure handling
    this.dataChannel.bufferedAmountLowThreshold = PROTOCOL_CONSTANTS.LOW_WATERMARK;

    // Send file metadata control message
    const metadata: FileMetadata = {
      transferId: this.transferId,
      name: this.file.name,
      size: this.file.size,
      mimeType: this.file.type || 'application/octet-stream',
      lastModified: this.file.lastModified,
      totalChunks,
      chunkSize
    };

    console.log(`[Sender] Starting transfer: ${this.file.name} (${this.file.size} bytes, ${totalChunks} chunks)`);
    this.dataChannel.send(JSON.stringify({ type: 'FILE_METADATA', metadata }));

    const startTime = performance.now();
    let bytesSent = 0;
    let lastProgressTime = startTime;
    let lastBytesSent = 0;
    let rollingSpeed = 0;

    // Helper to wait for DataChannel buffer to drain below low watermark
    const waitForBufferDrain = (): Promise<void> => {
      return new Promise((resolve) => {
        if (this.dataChannel.bufferedAmount <= PROTOCOL_CONSTANTS.LOW_WATERMARK) {
          resolve();
          return;
        }
        const onLow = () => {
          this.dataChannel.removeEventListener('bufferedamountlow', onLow);
          resolve();
        };
        this.dataChannel.addEventListener('bufferedamountlow', onLow);
      });
    };

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (this.isCancelled) {
          console.log('[Sender] Transfer cancelled by sender');
          this.dataChannel.send(JSON.stringify({ type: 'TRANSFER_CANCEL', transferId: this.transferId }));
          this.callbacks.onCancelled();
          return;
        }

        // Backpressure check
        if (this.dataChannel.bufferedAmount > PROTOCOL_CONSTANTS.HIGH_WATERMARK) {
          await waitForBufferDrain();
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, this.file.size);

        // Slice chunk from file without loading entire file into memory
        const blobSlice = this.file.slice(start, end);
        const arrayBuffer = await blobSlice.arrayBuffer();
        const chunkBytes = new Uint8Array(arrayBuffer);

        // Update incremental SHA-256
        hasher.update(chunkBytes);

        // Pack binary frame: [header 13B + payload]
        const packet = packBinaryChunk(transferIdHash, chunkIndex, chunkBytes);

        // Transmit over WebRTC DataChannel
        this.dataChannel.send(packet.buffer);
        bytesSent += chunkBytes.byteLength;

        // Calculate progress & rolling speed every ~150ms
        const now = performance.now();
        const interval = (now - lastProgressTime) / 1000;
        if (interval >= 0.15 || chunkIndex === totalChunks - 1) {
          const instantSpeed = (bytesSent - lastBytesSent) / interval;
          // Exponential rolling average: 70% previous, 30% instant
          rollingSpeed = rollingSpeed === 0 ? instantSpeed : rollingSpeed * 0.7 + instantSpeed * 0.3;
          const totalElapsed = (now - startTime) / 1000;
          const avgSpeed = bytesSent / (totalElapsed || 0.001);
          const remainingBytes = Math.max(0, this.file.size - bytesSent);
          const etaSeconds = rollingSpeed > 0 ? remainingBytes / rollingSpeed : 0;
          const percentage = Math.min(100, (bytesSent / (this.file.size || 1)) * 100);

          this.callbacks.onProgress({
            bytesTransferred: bytesSent,
            totalBytes: this.file.size,
            percentage,
            currentSpeed: rollingSpeed,
            averageSpeed: avgSpeed,
            etaSeconds,
            elapsedSeconds: totalElapsed
          });

          lastProgressTime = now;
          lastBytesSent = bytesSent;
        }
      }

      // Wait for any remaining buffer to drain before sending completion
      if (this.dataChannel.bufferedAmount > 0) {
        await waitForBufferDrain();
      }

      const finalSha256 = hasher.digest();
      const totalDuration = (performance.now() - startTime) / 1000;
      const finalAverageSpeed = this.file.size / (totalDuration || 0.001);

      console.log(`[Sender] All chunks sent. Final SHA-256: ${finalSha256}`);

      // Send transfer complete message with SHA-256
      this.dataChannel.send(
        JSON.stringify({
          type: 'TRANSFER_COMPLETE',
          transferId: this.transferId,
          sha256: finalSha256
        })
      );

      this.callbacks.onComplete({
        durationSeconds: totalDuration,
        averageSpeed: finalAverageSpeed,
        sha256: finalSha256
      });
    } catch (err: any) {
      console.error('[Sender] Error during file transfer:', err);
      this.callbacks.onError(err);
    }
  }

  public cancel() {
    this.isCancelled = true;
  }
}
