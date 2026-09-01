import crypto from 'crypto';

const MAGIC_HEADER_V1 = Buffer.from('SSTG', 'utf-8'); // 4 bytes legacy
const MAGIC_HEADER_V2 = Buffer.from('SSV2', 'utf-8'); // 4 bytes extended metadata
const SALT_SIZE = 16;
const IV_SIZE = 12;
const TAG_SIZE = 16;
const KEY_LEN = 32;
const ITERATIONS = 100000;

export interface PayloadMetadata {
  costMapMode: 'heuristic' | 'neural' | 'advanced' | 'fast';
  emdN?: number;
  threshA?: number;
  threshB?: number;
}

/**
 * Encrypts secret text using AES-256-GCM + PBKDF2 key derivation.
 * V2 Format: [MAGIC 'SSV2' 4b][FLAGS/MODE 4b][SALT 16b][IV 12b][PAYLOAD_LEN 4b][CIPHERTEXT][TAG 16b]
 */
export function encryptPayload(
  secretText: string,
  passphrase: string,
  metadata?: PayloadMetadata
): Buffer {
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);

  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LEN, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const textBuffer = Buffer.from(secretText, 'utf-8');

  const encrypted = Buffer.concat([cipher.update(textBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(encrypted.length, 0);

  // Encode metadata flags
  const flagsBuf = Buffer.alloc(4);
  const mode = metadata?.costMapMode || 'neural';
  let modeCode = 2; // default neural
  if (mode === 'heuristic' || mode === 'fast') modeCode = 0;
  else if (mode === 'advanced') modeCode = 1;
  else if (mode === 'neural') modeCode = 2;

  flagsBuf[0] = modeCode;
  flagsBuf[1] = metadata?.emdN === 3 ? 3 : 2;
  flagsBuf[2] = Math.round((metadata?.threshA ?? 0.35) * 100);
  flagsBuf[3] = Math.round((metadata?.threshB ?? 0.65) * 100);

  return Buffer.concat([MAGIC_HEADER_V2, flagsBuf, salt, iv, lenBuf, encrypted, tag]);
}

/**
 * Inspects payload buffer to extract stored metadata header without decrypting.
 */
export function inspectPayloadMetadata(payloadBuffer: Buffer): PayloadMetadata | null {
  if (payloadBuffer.length < 8) return null;

  const magic = payloadBuffer.subarray(0, 4);
  if (magic.equals(MAGIC_HEADER_V2)) {
    const modeCode = payloadBuffer[4];
    const emdN = payloadBuffer[5] === 3 ? 3 : 2;
    const threshA = payloadBuffer[6] / 100.0;
    const threshB = payloadBuffer[7] / 100.0;

    let costMapMode: 'heuristic' | 'neural' | 'advanced' = 'neural';
    if (modeCode === 0) costMapMode = 'heuristic';
    else if (modeCode === 1) costMapMode = 'advanced';
    else if (modeCode === 2) costMapMode = 'neural';

    return {
      costMapMode,
      emdN,
      threshA,
      threshB,
    };
  }

  if (magic.equals(MAGIC_HEADER_V1)) {
    return {
      costMapMode: 'heuristic',
      emdN: 2,
      threshA: 0.35,
      threshB: 0.65,
    };
  }

  return null;
}

/**
 * Decrypts binary payload using AES-256-GCM + PBKDF2.
 * Supports both V2 (with mode metadata) and V1 legacy formats.
 */
export function decryptPayload(
  payloadBuffer: Buffer,
  passphrase: string
): { plaintext: string; metadata?: PayloadMetadata } {
  if (payloadBuffer.length < 40) {
    throw new Error('Payload too short or corrupted.');
  }

  const magic = payloadBuffer.subarray(0, 4);
  const isV2 = magic.equals(MAGIC_HEADER_V2);
  const isV1 = magic.equals(MAGIC_HEADER_V1);

  if (!isV2 && !isV1) {
    throw new Error('Invalid magic header — image does not contain valid steganographic message.');
  }

  let offset = 4;
  let metadata: PayloadMetadata | undefined;

  if (isV2) {
    const modeCode = payloadBuffer[4];
    const emdN = payloadBuffer[5] === 3 ? 3 : 2;
    const threshA = payloadBuffer[6] / 100.0;
    const threshB = payloadBuffer[7] / 100.0;
    metadata = {
      costMapMode: modeCode === 0 ? 'heuristic' : modeCode === 1 ? 'advanced' : 'neural',
      emdN,
      threshA,
      threshB,
    };
    offset = 8;
  }

  const salt = payloadBuffer.subarray(offset, offset + SALT_SIZE);
  offset += SALT_SIZE;
  const iv = payloadBuffer.subarray(offset, offset + IV_SIZE);
  offset += IV_SIZE;
  const lenBuf = payloadBuffer.subarray(offset, offset + 4);
  offset += 4;
  const ciphertextLen = lenBuf.readUInt32BE(0);

  const totalExpected = offset + ciphertextLen + TAG_SIZE;
  if (payloadBuffer.length < totalExpected) {
    throw new Error('Incomplete payload buffer.');
  }

  const ciphertext = payloadBuffer.subarray(offset, offset + ciphertextLen);
  const tag = payloadBuffer.subarray(offset + ciphertextLen, totalExpected);

  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LEN, 'sha256');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return {
    plaintext: decrypted.toString('utf-8'),
    metadata,
  };
}
