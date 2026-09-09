/**
 * Signaling WebSocket Client
 * Connects to the local/network signaling server to coordinate WebRTC handshake.
 */

import {
  FileMetaSummary,
  SignalingMessage,
  SignalingSessionCreated,
  SignalingJoinSuccess,
  SignalingJoinError
} from '@sharefast/protocol';

export type SignalingEventMap = {
  sessionCreated: (data: SignalingSessionCreated['payload']) => void;
  receiverJoined: (sessionId: string) => void;
  joinSuccess: (data: SignalingJoinSuccess['payload']) => void;
  joinError: (data: SignalingJoinError['payload']) => void;
  offer: (sdp: RTCSessionDescriptionInit) => void;
  answer: (sdp: RTCSessionDescriptionInit) => void;
  iceCandidate: (candidate: RTCIceCandidateInit) => void;
  peerDisconnected: (reason: string) => void;
  sessionCancelled: (reason: string) => void;
  connected: () => void;
  disconnected: () => void;
  error: (err: Event | Error) => void;
};

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: { [K in keyof SignalingEventMap]?: SignalingEventMap[K][] } = {};
  private isExplicitlyClosed = false;

  constructor(serverUrl?: string) {
    if (serverUrl) {
      this.url = serverUrl;
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname || 'localhost';
      const port = process.env.NEXT_PUBLIC_SIGNALING_PORT || '4000';
      this.url = process.env.NEXT_PUBLIC_SIGNALING_URL || `${protocol}//${hostname}:${port}`;
    } else {
      this.url = 'ws://localhost:4000';
    }
  }

  public connect(): Promise<void> {
    this.isExplicitlyClosed = false;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.emit('connected');
        resolve();
      };

      this.ws.onerror = (evt) => {
        this.emit('error', evt);
        reject(new Error('Failed to connect to signaling server'));
      };

      this.ws.onclose = () => {
        this.emit('disconnected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: SignalingMessage = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('[SignalingClient] Parse error:', err);
        }
      };
    });
  }

  private handleMessage(msg: SignalingMessage) {
    switch (msg.type) {
      case 'SESSION_CREATED':
        this.emit('sessionCreated', msg.payload);
        break;
      case 'RECEIVER_JOINED':
        this.emit('receiverJoined', msg.payload.sessionId);
        break;
      case 'JOIN_SUCCESS':
        this.emit('joinSuccess', msg.payload);
        break;
      case 'JOIN_ERROR':
        this.emit('joinError', msg.payload);
        break;
      case 'SIGNAL_OFFER':
        this.emit('offer', msg.payload.sdp);
        break;
      case 'SIGNAL_ANSWER':
        this.emit('answer', msg.payload.sdp);
        break;
      case 'SIGNAL_ICE':
        this.emit('iceCandidate', msg.payload.candidate);
        break;
      case 'PEER_DISCONNECTED':
        this.emit('peerDisconnected', msg.payload.reason);
        break;
      case 'SESSION_CANCEL':
        this.emit('sessionCancelled', msg.payload.reason || 'Session ended');
        break;
    }
  }

  public send(msg: SignalingMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[SignalingClient] Cannot send, socket not open');
    }
  }

  public createSession(fileMeta: FileMetaSummary): Promise<SignalingSessionCreated['payload']> {
    return new Promise((resolve, reject) => {
      const onCreated = (data: SignalingSessionCreated['payload']) => {
        this.off('sessionCreated', onCreated);
        resolve(data);
      };
      const onError = (err: any) => {
        this.off('error', onError);
        reject(err);
      };

      this.on('sessionCreated', onCreated);
      this.on('error', onError);

      this.send({
        type: 'SESSION_CREATE',
        payload: { fileMeta }
      });
    });
  }

  public joinSession(params: { sessionId?: string; token?: string; otp?: string }): Promise<SignalingJoinSuccess['payload']> {
    return new Promise((resolve, reject) => {
      const onSuccess = (data: SignalingJoinSuccess['payload']) => {
        cleanup();
        resolve(data);
      };
      const onError = (err: SignalingJoinError['payload']) => {
        cleanup();
        reject(new Error(err.error));
      };
      const cleanup = () => {
        this.off('joinSuccess', onSuccess);
        this.off('joinError', onError);
      };

      this.on('joinSuccess', onSuccess);
      this.on('joinError', onError);

      this.send({
        type: 'JOIN_SESSION',
        payload: params
      });
    });
  }

  public sendOffer(sessionId: string, sdp: RTCSessionDescriptionInit) {
    this.send({
      type: 'SIGNAL_OFFER',
      payload: { sessionId, sdp }
    });
  }

  public sendAnswer(sessionId: string, sdp: RTCSessionDescriptionInit) {
    this.send({
      type: 'SIGNAL_ANSWER',
      payload: { sessionId, sdp }
    });
  }

  public sendIceCandidate(sessionId: string, candidate: RTCIceCandidateInit) {
    this.send({
      type: 'SIGNAL_ICE',
      payload: { sessionId, candidate }
    });
  }

  public cancelSession(sessionId: string, reason?: string) {
    this.send({
      type: 'SESSION_CANCEL',
      payload: { sessionId, reason }
    });
  }

  public on<K extends keyof SignalingEventMap>(event: K, listener: SignalingEventMap[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  public off<K extends keyof SignalingEventMap>(event: K, listener: SignalingEventMap[K]) {
    if (!this.listeners[event]) return;
    this.listeners[event] = (this.listeners[event] as any[]).filter((l) => l !== listener);
  }

  private emit<K extends keyof SignalingEventMap>(event: K, ...args: Parameters<SignalingEventMap[K]>) {
    const list = this.listeners[event];
    if (list) {
      for (const fn of list) {
        try {
          (fn as any)(...args);
        } catch (e) {
          console.error(`[SignalingClient] Error in listener for ${String(event)}:`, e);
        }
      }
    }
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
