import assert from 'node:assert';
import { spawn } from 'node:child_process';

const PORT = 4123;
console.log('--- Starting Signaling Server on Port ' + PORT + ' ---');

const serverProc = spawn('node', ['apps/signaling/dist/server.js'], {
  env: { ...process.env, SIGNALING_PORT: String(PORT) },
  stdio: 'pipe'
});

serverProc.stdout.on('data', (d) => {
  // console.log('[Server stdout]', d.toString());
});

serverProc.stderr.on('data', (d) => {
  console.error('[Server stderr]', d.toString());
});

// Wait 1.2s for server to boot
await new Promise((resolve) => setTimeout(resolve, 1200));

try {
  console.log('--- 1. Testing HTTP Health Endpoint ---');
  const res = await fetch(`http://localhost:${PORT}/health`);
  const healthJson = await res.json();
  assert.strictEqual(healthJson.status, 'ok', 'Health status must be ok');
  console.log('✓ Health check returned ok:', healthJson.service);

  console.log('--- 2. Connecting Sender WebSocket & Creating Session ---');
  const senderWs = new globalThis.WebSocket(`ws://localhost:${PORT}`);
  await new Promise((res) => (senderWs.onopen = res));

  let sessionData = null;
  const sessionCreatedPromise = new Promise((resolve) => {
    senderWs.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.type === 'SESSION_CREATED') {
        sessionData = msg.payload;
        resolve(sessionData);
      }
    });
  });

  senderWs.send(
    JSON.stringify({
      type: 'SESSION_CREATE',
      payload: {
        fileMeta: {
          name: 'presentation.zip',
          size: 104857600, // 100 MB
          mimeType: 'application/zip'
        }
      }
    })
  );

  const created = await sessionCreatedPromise;
  assert.ok(created.sessionId, 'Must have sessionId');
  assert.ok(created.token, 'Must have token');
  assert.ok(created.otp, 'Must have 6-digit OTP');
  assert.strictEqual(created.otp.length, 6, 'OTP must be 6 digits');
  console.log(`✓ Session created: ${created.sessionId}, OTP: ${created.otp}`);

  console.log('--- 3. Testing Rate Limiting on Invalid OTP ---');
  const rogueWs = new globalThis.WebSocket(`ws://localhost:${PORT}`);
  await new Promise((res) => (rogueWs.onopen = res));

  // Send bad OTP
  const badOtpPromise = new Promise((resolve) => {
    rogueWs.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.type === 'JOIN_ERROR') {
        resolve(msg.payload);
      }
    });
  });

  rogueWs.send(
    JSON.stringify({
      type: 'JOIN_SESSION',
      payload: { otp: '000000' }
    })
  );

  const joinErr = await badOtpPromise;
  assert.strictEqual(joinErr.code, 'INVALID_OTP');
  console.log('✓ Invalid OTP correctly rejected with code INVALID_OTP');
  rogueWs.close();

  console.log('--- 4. Receiver Joining with Valid OTP ---');
  const receiverWs = new globalThis.WebSocket(`ws://localhost:${PORT}`);
  await new Promise((res) => (receiverWs.onopen = res));

  const receiverJoinedOnSender = new Promise((resolve) => {
    senderWs.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.type === 'RECEIVER_JOINED') {
        resolve(msg.payload);
      }
    });
  });

  const receiverSuccess = new Promise((resolve) => {
    receiverWs.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.type === 'JOIN_SUCCESS') {
        resolve(msg.payload);
      }
    });
  });

  receiverWs.send(
    JSON.stringify({
      type: 'JOIN_SESSION',
      payload: { otp: created.otp }
    })
  );

  const [senderEvt, receiverEvt] = await Promise.all([
    receiverJoinedOnSender,
    receiverSuccess
  ]);

  assert.strictEqual(senderEvt.sessionId, created.sessionId);
  assert.strictEqual(receiverEvt.sessionId, created.sessionId);
  assert.strictEqual(receiverEvt.fileMeta.name, 'presentation.zip');
  console.log('✓ Receiver paired successfully via OTP! File confirmed:', receiverEvt.fileMeta.name);

  console.log('--- 5. Testing SDP & ICE Relay ---');
  const mockOffer = { type: 'offer', sdp: 'v=0\r\no=mock-sdp-test\r\ns=-\r\n' };
  const mockAnswer = { type: 'answer', sdp: 'v=0\r\no=mock-sdp-answer\r\ns=-\r\n' };

  const receiverGotOffer = new Promise((resolve) => {
    receiverWs.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.type === 'SIGNAL_OFFER') resolve(msg.payload);
    });
  });

  senderWs.send(
    JSON.stringify({
      type: 'SIGNAL_OFFER',
      payload: { sessionId: created.sessionId, sdp: mockOffer }
    })
  );

  const receivedOffer = await receiverGotOffer;
  assert.deepStrictEqual(receivedOffer.sdp, mockOffer);
  console.log('✓ SDP Offer relayed accurately to receiver');

  const senderGotAnswer = new Promise((resolve) => {
    senderWs.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.type === 'SIGNAL_ANSWER') resolve(msg.payload);
    });
  });

  receiverWs.send(
    JSON.stringify({
      type: 'SIGNAL_ANSWER',
      payload: { sessionId: created.sessionId, sdp: mockAnswer }
    })
  );

  const receivedAnswer = await senderGotAnswer;
  assert.deepStrictEqual(receivedAnswer.sdp, mockAnswer);
  console.log('✓ SDP Answer relayed accurately to sender');

  senderWs.close();
  receiverWs.close();

  console.log('\nAll End-to-End Signaling Tests Passed Successfully!\n');
} finally {
  serverProc.kill();
}
