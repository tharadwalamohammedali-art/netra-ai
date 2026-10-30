import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateEmail,
  validatePasswordStrength
} from '../auth/auth.js';
import { logAuditEvent } from '../services/auditService.js';
import { CONFIG } from '../config.js';

export function handleSignup({ db, body, clientIp }) {
  const { email, password } = body || {};

  if (!validateEmail(email)) {
    return {
      status: 400,
      data: { error: 'Please provide a valid email address (e.g., user@example.com).' }
    };
  }

  const passCheck = validatePasswordStrength(password);
  if (!passCheck.valid) {
    return { status: 400, data: { error: passCheck.error } };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check existing user
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return { status: 409, data: { error: 'An account with this email address already exists.' } };
  }

  const userId = crypto.randomUUID();
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  // Insert user
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 'user', 1, ?)
  `).run(userId, normalizedEmail, hash, salt, now);

  // Initialize privacy settings
  db.prepare(`
    INSERT INTO privacy_settings (
      user_id, history_retention_days, processing_mode, consent_given,
      email_monitoring_enabled, email_address, email_oauth_scope, email_last_synced, updated_at
    ) VALUES (?, 30, 'local_only', 1, 0, NULL, NULL, NULL, ?)
  `).run(userId, now);

  // Create session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, now, expiresAt);

  logAuditEvent({
    db,
    userId,
    eventType: 'auth_signup',
    ipAddress: clientIp,
    details: { email: normalizedEmail }
  });

  return {
    status: 201,
    data: {
      message: 'Account registered successfully.',
      token,
      user: { id: userId, email: normalizedEmail, role: 'user' }
    }
  };
}

export function handleLogin({ db, body, clientIp }) {
  const { email, password } = body || {};

  if (!email || !password) {
    return { status: 400, data: { error: 'Email and password are required.' } };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

  if (!user || !user.is_active) {
    logAuditEvent({
      db,
      userId: null,
      eventType: 'auth_login_failure',
      ipAddress: clientIp,
      details: { attemptedEmail: normalizedEmail, reason: 'user_not_found_or_inactive' }
    });
    return { status: 401, data: { error: 'Invalid email or password.' } };
  }

  const passwordValid = verifyPassword(password, user.password_hash, user.salt);
  if (!passwordValid) {
    logAuditEvent({
      db,
      userId: user.id,
      eventType: 'auth_login_failure',
      ipAddress: clientIp,
      details: { attemptedEmail: normalizedEmail, reason: 'invalid_credentials' }
    });
    return { status: 401, data: { error: 'Invalid email or password.' } };
  }

  const token = generateSessionToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, user.id, now, expiresAt);

  logAuditEvent({
    db,
    userId: user.id,
    eventType: 'auth_login_success',
    ipAddress: clientIp,
    details: { email: user.email }
  });

  return {
    status: 200,
    data: {
      message: 'Login successful.',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    }
  };
}

export function handleLogout({ db, token, userId, clientIp }) {
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  logAuditEvent({
    db,
    userId,
    eventType: 'auth_logout',
    ipAddress: clientIp
  });
  return { status: 200, data: { message: 'Logged out successfully.' } };
}

export function handleDeleteAccount({ db, userId, clientIp }) {
  logAuditEvent({
    db,
    userId,
    eventType: 'account_deleted',
    ipAddress: clientIp,
    details: { reason: 'user_requested_purge' }
  });

  // Due to ON DELETE CASCADE on foreign keys, all scans, sessions, messages, privacy settings are purged
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  return {
    status: 200,
    data: { message: 'Account and all associated scan data have been permanently deleted.' }
  };
}
