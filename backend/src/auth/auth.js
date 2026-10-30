import crypto from 'node:crypto';
import { CONFIG } from '../config.js';

export function hashPassword(password, salt = null) {
  const actualSalt = salt || crypto.randomBytes(CONFIG.PASSWORD_SALT_BYTES).toString('hex');
  const hash = crypto
    .pbkdf2Sync(
      password,
      actualSalt,
      CONFIG.PASSWORD_HASH_ITERATIONS,
      CONFIG.PASSWORD_KEY_LEN,
      CONFIG.PASSWORD_DIGEST
    )
    .toString('hex');

  return { hash, salt: actualSalt };
}

export function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = hashPassword(password, storedSalt);
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (hashBuffer.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashBuffer, storedBuffer);
  } catch {
    return false;
  }
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase()) && email.length <= 120;
}

export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters' };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return { valid: false, error: 'Password must include at least one letter and one number' };
  }
  return { valid: true };
}
