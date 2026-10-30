import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/db/database.js';
import {
  hashPassword,
  verifyPassword,
  validateEmail,
  validatePasswordStrength
} from '../src/auth/auth.js';
import {
  handleSignup,
  handleLogin,
  handleLogout,
  handleDeleteAccount
} from '../src/controllers/authController.js';

test('Auth: Password hashing, verification and timing-safe comparison', () => {
  const password = 'SuperSecurePassword123!';
  const { hash, salt } = hashPassword(password);

  assert.ok(hash && hash.length === 128); // 64 bytes hex
  assert.ok(salt && salt.length === 32);  // 16 bytes hex

  assert.equal(verifyPassword(password, hash, salt), true);
  assert.equal(verifyPassword('WrongPassword123!', hash, salt), false);
  assert.equal(verifyPassword('', hash, salt), false);
});

test('Auth: Validation rules for email and password', () => {
  assert.equal(validateEmail('analyst@netra.local'), true);
  assert.equal(validateEmail('invalid-email'), false);
  assert.equal(validateEmail(''), false);

  assert.equal(validatePasswordStrength('short').valid, false);
  assert.equal(validatePasswordStrength('onlylettersnohash').valid, false);
  assert.equal(validatePasswordStrength('validPass123').valid, true);
});

test('Auth: Full User Lifecycle (Signup, Duplicate Rejection, Login, Delete)', () => {
  const db = getDatabase(':memory:');

  // 1. Signup
  const signupRes = handleSignup({
    db,
    body: { email: 'sec_officer@netra.ai', password: 'SecuredPassword2026' },
    clientIp: '127.0.0.1'
  });
  assert.equal(signupRes.status, 201);
  assert.ok(signupRes.data.token);
  assert.equal(signupRes.data.user.email, 'sec_officer@netra.ai');

  // 2. Duplicate email rejected
  const dupRes = handleSignup({
    db,
    body: { email: 'sec_officer@netra.ai', password: 'AnotherPassword123' },
    clientIp: '127.0.0.1'
  });
  assert.equal(dupRes.status, 409);

  // 3. Login with correct credentials
  const loginRes = handleLogin({
    db,
    body: { email: 'sec_officer@netra.ai', password: 'SecuredPassword2026' },
    clientIp: '127.0.0.1'
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.data.token);

  // 4. Login with incorrect password
  const failLogin = handleLogin({
    db,
    body: { email: 'sec_officer@netra.ai', password: 'WrongPassword999' },
    clientIp: '127.0.0.1'
  });
  assert.equal(failLogin.status, 401);

  // 5. Account deletion & cascade
  const delRes = handleDeleteAccount({
    db,
    userId: signupRes.data.user.id,
    clientIp: '127.0.0.1'
  });
  assert.equal(delRes.status, 200);

  // User should no longer exist
  const check = db.prepare('SELECT id FROM users WHERE id = ?').get(signupRes.data.user.id);
  assert.equal(check, undefined);
});
