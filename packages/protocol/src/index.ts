/**
 * @sharefast/protocol
 * Core Protocol Types and Constants for ShareFast P2P Transfer
 */

export const PROTOCOL_CONSTANTS = {
  CHUNK_SIZE: 64 * 1024, // 64 KB binary chunk
  HIGH_WATERMARK: 4 * 1024 * 1024, // 4 MB backpressure pause threshold
  LOW_WATERMARK: 1024 * 1024, // 1 MB backpressure resume threshold
  OTP_LENGTH: 6,
  SESSION_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes session expiration
  MAX_OTP_ATTEMPTS: 5,
  BINARY_HEADER_SIZE: 13, // [type:1, transferIdHash:4, chunkIndex:4, chunkSize:4]
  CHUNK_TYPE_DATA: 0x01,
  DEFAULT_STUN_SERVERS: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302'
  ]
} as const;

export interface FileMetaSummary {
  name: string;
  size: number;
  mimeType: string;
  lastModified?: number;
}

export interface FileMetadata extends FileMetaSummary {
  transferId: string;
  totalChunks: number;
  chunkSize: number;
  sha256?: string;
}

// Signaling WebSocket message types
export type SignalingMessageType =
  | 'SESSION_CREATE'
  | 'SESSION_CREATED'
  | 'JOIN_SESSION'
  | 'JOIN_SUCCESS'
  | 'JOIN_ERROR'
  | 'RECEIVER_JOINED'
  | 'SIGNAL_OFFER'
  | 'SIGNAL_ANSWER'
  | 'SIGNAL_ICE'
  | 'SESSION_CANCEL'
  | 'PEER_DISCONNECTED';

export interface SignalingSessionCreate {
  type: 'SESSION_CREATE';
  payload: {
    fileMeta: FileMetaSummary;
  };
}

export interface SignalingSessionCreated {
  type: 'SESSION_CREATED';
  payload: {
    sessionId: string;
    token: string;
    otp: string;
    expiresAt: number;
  };
}

export interface SignalingJoinSession {
  type: 'JOIN_SESSION';
  payload: {
    sessionId?: string;
    token?: string;
    otp?: string;
  };
}

export interface SignalingJoinSuccess {
  type: 'JOIN_SUCCESS';
  payload: {
    sessionId: string;
    fileMeta: FileMetaSummary;
  };
}

export interface SignalingJoinError {
  type: 'JOIN_ERROR';
  payload: {
    error: string;
    code: 'INVALID_OTP' | 'RATE_LIMITED' | 'EXPIRED' | 'NOT_FOUND' | 'ALREADY_PAIRED';
    remainingAttempts?: number;
  };
}

export interface SignalingReceiverJoined {
  type: 'RECEIVER_JOINED';
  payload: {
    sessionId: string;
  };
}

export interface SignalingOffer {
  type: 'SIGNAL_OFFER';
  payload: {
    sessionId: string;
    sdp: RTCSessionDescriptionInit;
  };
}

export interface SignalingAnswer {
  type: 'SIGNAL_ANSWER';
  payload: {
    sessionId: string;
    sdp: RTCSessionDescriptionInit;
  };
}

export interface SignalingIce {
  type: 'SIGNAL_ICE';
  payload: {
    sessionId: string;
    candidate: RTCIceCandidateInit;
  };
}

export interface SignalingSessionCancel {
  type: 'SESSION_CANCEL';
  payload: {
    sessionId: string;
    reason?: string;
  };
}

export interface SignalingPeerDisconnected {
  type: 'PEER_DISCONNECTED';
  payload: {
    sessionId: string;
    reason: string;
  };
}

export type SignalingMessage =
  | SignalingSessionCreate
  | SignalingSessionCreated
  | SignalingJoinSession
  | SignalingJoinSuccess
  | SignalingJoinError
  | SignalingReceiverJoined
  | SignalingOffer
  | SignalingAnswer
  | SignalingIce
  | SignalingSessionCancel
  | SignalingPeerDisconnected;

// DataChannel Control Messages
export type TransferControlMessageType =
  | 'FILE_METADATA'
  | 'TRANSFER_START'
  | 'TRANSFER_PAUSE'
  | 'TRANSFER_RESUME'
  | 'TRANSFER_CANCEL'
  | 'TRANSFER_COMPLETE'
  | 'TRANSFER_ACK'
  | 'HASH_VERIFY'
  | 'HASH_VERIFIED';

export interface TransferControlMessage {
  type: TransferControlMessageType;
  transferId: string;
  payload?: any;
}

export interface TransferStats {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  currentSpeed: number; // bytes per second
  averageSpeed: number; // bytes per second
  etaSeconds: number; // estimated seconds remaining
  elapsedSeconds: number;
}
