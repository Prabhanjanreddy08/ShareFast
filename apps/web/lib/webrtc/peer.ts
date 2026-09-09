/**
 * WebRTC Peer Connection Manager
 * Coordinates RTCPeerConnection lifecycle, SDP exchange, and queued ICE candidate handling.
 */

import { PROTOCOL_CONSTANTS } from '@sharefast/protocol';

export interface PeerConnectionCallbacks {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (err: Error) => void;
}

export class WebRTCPeer {
  private pc: RTCPeerConnection | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;
  private callbacks: PeerConnectionCallbacks;

  constructor(callbacks: PeerConnectionCallbacks) {
    this.callbacks = callbacks;
    this.initPeerConnection();
  }

  private initPeerConnection() {
    const config: RTCConfiguration = {
      iceServers: PROTOCOL_CONSTANTS.DEFAULT_STUN_SERVERS.map((url) => ({ urls: url })),
      iceCandidatePoolSize: 10
    };

    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      console.log(`[WebRTC] Connection state: ${this.pc.connectionState}`);
      this.callbacks.onConnectionStateChange?.(this.pc.connectionState);
    };

    this.pc.ondatachannel = (event) => {
      console.log(`[WebRTC] Received remote data channel: ${event.channel.label}`);
      this.callbacks.onDataChannel?.(event.channel);
    };
  }

  public createDataChannel(label = 'sharefast-transfer'): RTCDataChannel {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    // Reliable, ordered DataChannel for byte-level file transfer
    const dc = this.pc.createDataChannel(label, {
      ordered: true
    });
    dc.binaryType = 'arraybuffer';
    return dc;
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription!.toJSON();
  }

  public async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    this.hasRemoteDescription = true;
    await this.flushIceQueue();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription!.toJSON();
  }

  public async setAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this.hasRemoteDescription = true;
    await this.flushIceQueue();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.hasRemoteDescription) {
      // Queue candidate until setRemoteDescription finishes
      this.iceCandidateQueue.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] Failed to add ICE candidate:', err);
    }
  }

  private async flushIceQueue() {
    if (!this.pc) return;
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift()!;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to flush queued ICE candidate:', err);
      }
    }
  }

  public get connectionState(): RTCPeerConnectionState {
    return this.pc ? this.pc.connectionState : 'closed';
  }

  public close() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.hasRemoteDescription = false;
    this.iceCandidateQueue = [];
  }
}
