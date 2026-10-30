import { CONFIG } from '../config.js';

// In-memory rate limiting map: ip -> { count, resetTime }
const rateLimitMap = new Map();

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' data:; connect-src 'self'; img-src 'self' data: blob:;"
  );
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
}

export function checkRateLimit(req, maxRequests = CONFIG.RATE_LIMIT_MAX_REQUESTS, windowMs = CONFIG.RATE_LIMIT_WINDOW_MS) {
  const ip = req.socket?.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(ip, record);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
    };
  }

  return { allowed: true, remaining: maxRequests - record.count };
}

export function extractAuthToken(req) {
  // Check Authorization header: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Check Cookie header: netra_session=<token>
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/netra_session=([a-f0-9]{64})/i);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function authenticateRequest(req, db) {
  const token = extractAuthToken(req);
  if (!token) {
    return null;
  }

  const stmt = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at, u.email, u.role, u.is_active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `);
  const session = stmt.get(token);

  if (!session) {
    return null;
  }

  // Check expiration
  const now = new Date();
  const expiresAt = new Date(session.expires_at);
  if (now > expiresAt || !session.is_active) {
    // Clean up expired session
    try {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    } catch {
      // ignore
    }
    return null;
  }

  return {
    userId: session.user_id,
    email: session.email,
    role: session.role,
    token: session.token
  };
}
