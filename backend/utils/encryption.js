/**
 * AES-256-GCM Token Encryption Utility
 * Provides authenticated encryption at rest for Meta WhatsApp access tokens,
 * secrets, and third-party API keys.
 */
import crypto from 'crypto';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = 'enc:gcm:';

// Derive a deterministic 32-byte key from SECRET_KEY using scrypt
function getDerivedKey() {
  const masterKey = process.env.ENCRYPTION_KEY || config.SECRET_KEY || 'bizmate_fallback_secret_key_32_bytes_min!';
  return crypto.scryptSync(masterKey, 'bizmate_salt_2026', 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns formatted string: enc:gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext; // Already encrypted

  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    logger.error('[Encryption] Encrypt failed:', err.message);
    throw new Error('Failed to encrypt secret token');
  }
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Gracefully returns plaintext as-is if not prefixed with enc:gcm: (backward compatibility).
 */
export function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // Legacy plaintext

  try {
    const key = getDerivedKey();
    const parts = ciphertext.slice(PREFIX.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted token format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    logger.warn('[Encryption] Decrypt failed or tag mismatch:', err.message);
    throw new Error('Invalid encryption key or tampered ciphertext');
  }
}
