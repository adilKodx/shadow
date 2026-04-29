/**
 * ShadowField E2E Encryption — AES-256-GCM via Web Crypto API
 *
 * Each tenant gets a 256-bit symmetric key generated at org creation.
 * Messages are encrypted client-side before insert, decrypted on read.
 * Key is stored base64-encoded in tenant_encryption_keys (RLS-protected).
 *
 * Format: base64(iv:ciphertext) — 12-byte IV prepended to ciphertext.
 */

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

// ─── Key Management ───

/** Generate a new AES-256 key and export as base64 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

/** Import a base64-encoded key for use */
async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt / Decrypt ───

/** Encrypt plaintext → base64(iv + ciphertext) */
export async function encryptMessage(plaintext: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return arrayBufferToBase64(combined.buffer);
}

/** Decrypt base64(iv + ciphertext) → plaintext */
export async function decryptMessage(encrypted: string, base64Key: string): Promise<string> {
  try {
    const key = await importKey(base64Key);
    const combined = new Uint8Array(base64ToArrayBuffer(encrypted));

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, return the original (might be unencrypted legacy message)
    return encrypted;
  }
}

/** Check if a string looks like an encrypted message (base64 with sufficient length) */
export function isEncrypted(content: string): boolean {
  // Encrypted messages are base64-encoded and at least IV_LENGTH + 16 bytes (AES block)
  if (content.length < 40) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(content);
}

// ─── Helpers ───

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
