import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '127.0.0.1',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../../../netra.db'),
  
  // Security & Auth
  SESSION_SECRET: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  SESSION_TTL_HOURS: parseInt(process.env.SESSION_TTL_HOURS || '24', 10),
  PASSWORD_SALT_BYTES: 16,
  PASSWORD_HASH_ITERATIONS: 100000,
  PASSWORD_KEY_LEN: 64,
  PASSWORD_DIGEST: 'sha256',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: 120,
  
  // Gemma 3:1B Model Interface
  GEMMA3_ENDPOINT: process.env.GEMMA3_ENDPOINT || 'http://127.0.0.1:8080/v1/chat/completions',
  GEMMA3_MODEL_NAME: 'gemma-3-1b-it',
  GEMMA3_TIMEOUT_MS: parseInt(process.env.GEMMA3_TIMEOUT_MS || '6000', 10),
  
  // App Limits
  MAX_INPUT_TEXT_LENGTH: 50000, // 50 KB max text
  MAX_IMAGE_UPLOAD_BYTES: 5 * 1024 * 1024, // 5 MB max image
  
  // Paths
  STATIC_DIR: path.join(__dirname, '../../frontend'),
  
  // Disclosures
  DISCLOSURE_TEXT: 'NETRA AI combines deterministic explainable security rules with Gemma 3:1B local inference. URL appearance or small model heuristics cannot guarantee 100% scam prevention. Always independently verify suspicious requests through official contact channels.'
};
