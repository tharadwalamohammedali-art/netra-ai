import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/db/database.js';
import {
  handleGetPrivacySettings,
  handleUpdatePrivacySettings,
  handleToggleEmailMonitoring
} from '../src/controllers/privacyController.js';

function createTestUser(db, userId, email) {
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, is_active, created_at)
    VALUES (?, ?, 'dummy_hash', 'dummy_salt', 'user', 1, ?)
  `).run(userId, email, new Date().toISOString());
}

test('Privacy & Consent: Retrieval and default settings initialization', () => {
  const db = getDatabase(':memory:');
  const userId = 'user-privacy-test-1';
  createTestUser(db, userId, 'user1@privacy.test');

  const res = handleGetPrivacySettings({ db, userId });
  assert.equal(res.status, 200);
  assert.equal(res.data.privacy.historyRetentionDays, 30);
  assert.equal(res.data.privacy.processingMode, 'local_only');
  assert.equal(res.data.emailMonitoring.enabled, false);
  assert.ok(res.data.disclosures.localProcessing);
});

test('Privacy & Consent: Zero-retention immediately purges scan history', () => {
  const db = getDatabase(':memory:');
  const userId = 'user-privacy-test-2';
  createTestUser(db, userId, 'user2@privacy.test');

  // Seed a scan
  db.prepare(`
    INSERT INTO scans (
      id, user_id, scan_type, target_preview, risk_score, severity,
      category, evidence_json, explanation, recommended_actions_json,
      uncertainty, engine_used, engine_status, created_at
    ) VALUES ('scan-1', ?, 'url', 'test.com', 10, 'Low', 'Clean', '[]', 'Safe', '[]', 'Low', 'Rules', 'ok', ?)
  `).run(userId, new Date().toISOString());

  // Confirm scan exists
  const countBefore = db.prepare('SELECT COUNT(*) as c FROM scans WHERE user_id = ?').get(userId).c;
  assert.equal(countBefore, 1);

  // Update retention to 0 days (purge)
  const updateRes = handleUpdatePrivacySettings({
    db,
    userId,
    body: { historyRetentionDays: 0, processingMode: 'local_only' },
    clientIp: '127.0.0.1'
  });
  assert.equal(updateRes.status, 200);

  // Scans should be wiped
  const countAfter = db.prepare('SELECT COUNT(*) as c FROM scans WHERE user_id = ?').get(userId).c;
  assert.equal(countAfter, 0);
});

test('Privacy & Consent: Email threat monitoring enable and revocation', () => {
  const db = getDatabase(':memory:');
  const userId = 'user-privacy-test-3';
  createTestUser(db, userId, 'user3@privacy.test');

  // Enable
  const enableRes = handleToggleEmailMonitoring({
    db,
    userId,
    body: { enable: true, emailAddress: 'analyst@company.org' },
    clientIp: '127.0.0.1'
  });
  assert.equal(enableRes.status, 200);
  assert.equal(enableRes.data.emailMonitoring.enabled, true);
  assert.equal(enableRes.data.emailMonitoring.emailAddress, 'analyst@company.org');

  // Revoke
  const revokeRes = handleToggleEmailMonitoring({
    db,
    userId,
    body: { enable: false },
    clientIp: '127.0.0.1'
  });
  assert.equal(revokeRes.status, 200);
  assert.equal(revokeRes.data.emailMonitoring.enabled, false);
  assert.equal(revokeRes.data.emailMonitoring.emailAddress, null);
});
