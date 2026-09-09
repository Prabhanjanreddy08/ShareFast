import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { generateSecureToken, generateOtp } from '@sharefast/crypto';
import {
  FileMetaSummary,
  PROTOCOL_CONSTANTS,
  SignalingMessage
} from '@sharefast/protocol';

interface Session {
  sessionId: string;
  token: string;
  otp: string;
  fileMeta: FileMetaSummary;
  senderWs: WebSocket;
  receiverWs: WebSocket | null;
  failedOtpAttempts: number;
  createdAt: number;
  expiresAt: number;
  timeoutTimer: NodeJS.Timeout;
}

const PORT = parseInt(process.env.SIGNALING_PORT || process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const sessions = new Map<string, Session>();
const otpToSessionId = new Map<string, string>();
const socketToSessionId = new WeakMap<WebSocket, string>();

function safeSend(ws: WebSocket | null | undefined, message: SignalingMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('[Signaling] Failed to send message:', err);
    }
  }
}

function destroySession(sessionId: string, reason: string = 'Session closed') {
  const session = sessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.timeoutTimer);
  sessions.delete(sessionId);
  otpToSessionId.delete(session.otp);

  console.log(`[Session] Destroyed: ${sessionId} (Reason: ${reason})`);

  safeSend(session.senderWs, {
    type: 'SESSION_CANCEL',
    payload: { sessionId, reason }
  });
  safeSend(session.receiverWs, {
    type: 'SESSION_CANCEL',
    payload: { sessionId, reason }
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'ShareFast Signaling Server',
        activeSessions: sessions.size,
        timestamp: new Date().toISOString()
      })
    );
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Signaling] New client connected from ${clientIp}`);

  ws.on('message', (data: Buffer | string) => {
    let msg: SignalingMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.warn('[Signaling] Received malformed JSON');
      return;
    }

    switch (msg.type) {
      case 'SESSION_CREATE': {
        const { fileMeta } = msg.payload;
        if (!fileMeta || !fileMeta.name || typeof fileMeta.size !== 'number') {
          console.warn('[Signaling] Invalid fileMeta on session create');
          return;
        }

        const sessionId = generateSecureToken(16);
        const token = generateSecureToken(24);

        // Generate unique 6-digit OTP
        let otp = generateOtp(PROTOCOL_CONSTANTS.OTP_LENGTH);
        let attempts = 0;
        while (otpToSessionId.has(otp) && attempts < 10) {
          otp = generateOtp(PROTOCOL_CONSTANTS.OTP_LENGTH);
          attempts++;
        }

        const expiresAt = Date.now() + PROTOCOL_CONSTANTS.SESSION_TIMEOUT_MS;
        const timeoutTimer = setTimeout(() => {
          destroySession(sessionId, 'Session expired after 10 minutes');
        }, PROTOCOL_CONSTANTS.SESSION_TIMEOUT_MS);

        const session: Session = {
          sessionId,
          token,
          otp,
          fileMeta,
          senderWs: ws,
          receiverWs: null,
          failedOtpAttempts: 0,
          createdAt: Date.now(),
          expiresAt,
          timeoutTimer
        };

        sessions.set(sessionId, session);
        otpToSessionId.set(otp, sessionId);
        socketToSessionId.set(ws, sessionId);

        console.log(`[Session] Created: ${sessionId} | OTP: ${otp} | File: ${fileMeta.name} (${(fileMeta.size / (1024 * 1024)).toFixed(2)} MB)`);

        safeSend(ws, {
          type: 'SESSION_CREATED',
          payload: {
            sessionId,
            token,
            otp,
            expiresAt
          }
        });
        break;
      }

      case 'JOIN_SESSION': {
        const { sessionId, token, otp } = msg.payload;
        let targetSessionId = sessionId;

        if (otp) {
          const cleanOtp = otp.trim();
          targetSessionId = otpToSessionId.get(cleanOtp);
          if (!targetSessionId) {
            safeSend(ws, {
              type: 'JOIN_ERROR',
              payload: {
                error: 'Invalid or expired 6-digit pairing code.',
                code: 'INVALID_OTP'
              }
            });
            return;
          }
        }

        if (!targetSessionId || !sessions.has(targetSessionId)) {
          safeSend(ws, {
            type: 'JOIN_ERROR',
            payload: {
              error: 'Session not found or has expired.',
              code: 'NOT_FOUND'
            }
          });
          return;
        }

        const session = sessions.get(targetSessionId)!;

        // Check if session has timed out
        if (Date.now() > session.expiresAt) {
          destroySession(targetSessionId, 'Session expired');
          safeSend(ws, {
            type: 'JOIN_ERROR',
            payload: {
              error: 'Session has expired.',
              code: 'EXPIRED'
            }
          });
          return;
        }

        // Validate token if joining via URL
        if (token && token !== session.token) {
          safeSend(ws, {
            type: 'JOIN_ERROR',
            payload: {
              error: 'Invalid authentication token.',
              code: 'NOT_FOUND'
            }
          });
          return;
        }

        // Validate OTP rate limiting
        if (otp && otp.trim() !== session.otp) {
          session.failedOtpAttempts++;
          const remaining = PROTOCOL_CONSTANTS.MAX_OTP_ATTEMPTS - session.failedOtpAttempts;
          if (session.failedOtpAttempts >= PROTOCOL_CONSTANTS.MAX_OTP_ATTEMPTS) {
            destroySession(targetSessionId, 'Maximum OTP attempts exceeded');
            safeSend(ws, {
              type: 'JOIN_ERROR',
              payload: {
                error: 'Maximum OTP attempts exceeded. Session invalidated.',
                code: 'RATE_LIMITED'
              }
            });
            return;
          } else {
            safeSend(ws, {
              type: 'JOIN_ERROR',
              payload: {
                error: `Incorrect code. ${remaining} attempts remaining.`,
                code: 'INVALID_OTP',
                remainingAttempts: remaining
              }
            });
            return;
          }
        }

        // Check if already paired
        if (session.receiverWs && session.receiverWs !== ws) {
          safeSend(ws, {
            type: 'JOIN_ERROR',
            payload: {
              error: 'Another receiver has already joined this session.',
              code: 'ALREADY_PAIRED'
            }
          });
          return;
        }

        // Pairing successful!
        session.receiverWs = ws;
        socketToSessionId.set(ws, session.sessionId);

        // Invalidate OTP so it cannot be used again
        otpToSessionId.delete(session.otp);

        console.log(`[Session] Receiver joined session: ${session.sessionId}`);

        // Send JOIN_SUCCESS to receiver with file metadata
        safeSend(ws, {
          type: 'JOIN_SUCCESS',
          payload: {
            sessionId: session.sessionId,
            fileMeta: session.fileMeta
          }
        });

        // Notify sender that receiver joined
        safeSend(session.senderWs, {
          type: 'RECEIVER_JOINED',
          payload: {
            sessionId: session.sessionId
          }
        });
        break;
      }

      case 'SIGNAL_OFFER': {
        const { sessionId, sdp } = msg.payload;
        const session = sessions.get(sessionId);
        if (session && session.receiverWs) {
          safeSend(session.receiverWs, {
            type: 'SIGNAL_OFFER',
            payload: { sessionId, sdp }
          });
        }
        break;
      }

      case 'SIGNAL_ANSWER': {
        const { sessionId, sdp } = msg.payload;
        const session = sessions.get(sessionId);
        if (session && session.senderWs) {
          safeSend(session.senderWs, {
            type: 'SIGNAL_ANSWER',
            payload: { sessionId, sdp }
          });
        }
        break;
      }

      case 'SIGNAL_ICE': {
        const { sessionId, candidate } = msg.payload;
        const session = sessions.get(sessionId);
        if (!session) return;

        // Relay candidate to whichever peer is the counterpart
        if (ws === session.senderWs && session.receiverWs) {
          safeSend(session.receiverWs, {
            type: 'SIGNAL_ICE',
            payload: { sessionId, candidate }
          });
        } else if (ws === session.receiverWs && session.senderWs) {
          safeSend(session.senderWs, {
            type: 'SIGNAL_ICE',
            payload: { sessionId, candidate }
          });
        }
        break;
      }

      case 'SESSION_CANCEL': {
        const { sessionId, reason } = msg.payload;
        destroySession(sessionId, reason || 'Cancelled by user');
        break;
      }
    }
  });

  ws.on('close', () => {
    const sessionId = socketToSessionId.get(ws);
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    if (ws === session.senderWs) {
      console.log(`[Session] Sender disconnected for ${sessionId}`);
      safeSend(session.receiverWs, {
        type: 'PEER_DISCONNECTED',
        payload: { sessionId, reason: 'Sender disconnected' }
      });
      destroySession(sessionId, 'Sender disconnected');
    } else if (ws === session.receiverWs) {
      console.log(`[Session] Receiver disconnected for ${sessionId}`);
      safeSend(session.senderWs, {
        type: 'PEER_DISCONNECTED',
        payload: { sessionId, reason: 'Receiver disconnected' }
      });
      session.receiverWs = null;
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`
======================================================
  ShareFast Signaling Server
  Listening on http://${HOST}:${PORT} (ws://${HOST}:${PORT})
  P2P Direct WebRTC Transfer Ready
======================================================
`);
});
