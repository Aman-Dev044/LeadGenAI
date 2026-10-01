import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Symmetric encryption for secrets we must be able to read back (tenant API
 * keys), as opposed to passwords, which are hashed and never recovered.
 *
 * Format: `v1:<iv>:<authTag>:<ciphertext>`, all base64. AES-256-GCM, so a
 * tampered ciphertext fails to decrypt instead of returning garbage.
 */

const VERSION = 'v1';
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const ALGORITHM = 'aes-256-gcm';

/**
 * ENCRYPTION_KEY is a human-typed string of any length, so it is hashed to the
 * exact 32 bytes AES-256 needs rather than being truncated or padded.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/**
 * Returns null rather than throwing when a value cannot be decrypted - a key
 * rotation should degrade one credential to "not configured", not take down
 * every request that touches the collection.
 */
export function decryptSecret(payload: string, secret: string): string | null {
  if (!payload || typeof payload !== 'string') return null;
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  try {
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    return null;
  }
}

/** True when a string looks like output of `encryptSecret`. */
export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`) && value.split(':').length === 4;
}

/**
 * The only form of a secret that is ever allowed to leave the server: enough
 * tail to recognise which key is stored, never enough to use or reconstruct it.
 */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return '';
  const tail = plaintext.length > 4 ? plaintext.slice(-4) : '';
  return `${'•'.repeat(8)}${tail}`;
}
