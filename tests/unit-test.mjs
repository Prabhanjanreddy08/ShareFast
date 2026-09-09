import assert from 'node:assert';
import crypto from 'node:crypto';
import { packBinaryChunk, unpackBinaryChunk, stringHash32, generateOtp, generateSecureToken, IncrementalSha256 } from '../packages/crypto/src/index.ts';

console.log('--- 1. Testing Token & OTP Generation ---');
const token = generateSecureToken(16);
assert.strictEqual(token.length, 32, 'Token should be 32 hex chars');

const otp = generateOtp(6);
assert.strictEqual(otp.length, 6, 'OTP must be exactly 6 digits');
assert.match(otp, /^\d{6}$/, 'OTP must consist only of digits');
console.log('✓ Token and OTP generation verified');

console.log('--- 2. Testing Binary Packet Framing (13-Byte Header) ---');
const transferId = 'transfer-test-12345';
const transferIdHash = stringHash32(transferId);
const testPayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]);
const chunkIndex = 42;

const packed = packBinaryChunk(transferIdHash, chunkIndex, testPayload);
assert.strictEqual(packed.byteLength, 13 + testPayload.byteLength, 'Packed packet length must equal header + payload');

const unpacked = unpackBinaryChunk(packed.buffer);
assert.strictEqual(unpacked.type, 0x01, 'Type must be CHUNK_DATA (0x01)');
assert.strictEqual(unpacked.transferIdHash, transferIdHash, 'Transfer ID hash must match');
assert.strictEqual(unpacked.chunkIndex, chunkIndex, 'Chunk index must match');
assert.strictEqual(unpacked.chunkSize, testPayload.byteLength, 'Chunk size must match');
assert.deepStrictEqual(Array.from(unpacked.payload), Array.from(testPayload), 'Payload bytes must match exactly');
console.log('✓ Binary chunk header pack and unpack verified');

console.log('--- 3. Testing Incremental SHA-256 vs Node Crypto ---');
const randomBuffer = crypto.randomBytes(512 * 1024); // 512 KB
const expectedSha256 = crypto.createHash('sha256').update(randomBuffer).digest('hex');

const incrementalHasher = new IncrementalSha256();
// Feed in 64 KB slices like the WebRTC transfer engine does
const chunkSize = 64 * 1024;
for (let i = 0; i < randomBuffer.length; i += chunkSize) {
  const slice = randomBuffer.subarray(i, i + chunkSize);
  incrementalHasher.update(slice);
}
const calculatedSha256 = incrementalHasher.digest();

assert.strictEqual(
  calculatedSha256.toLowerCase(),
  expectedSha256.toLowerCase(),
  'Incremental SHA-256 must match Node crypto SHA-256 byte-for-byte'
);
console.log(`✓ SHA-256 match confirmed: ${calculatedSha256}`);

console.log('\nAll protocol & crypto unit tests passed successfully!\n');
