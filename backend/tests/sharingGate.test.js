import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/db/database.js';
import {
  evaluateAndSendMessage,
  submitFalsePositiveAppeal,
  getUserSharedMessages
} from '../src/services/sharingGate.js';

function createTestUser(db, userId, email) {
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, is_active, created_at)
    VALUES (?, ?, 'dummy_hash', 'dummy_salt', 'user', 1, ?)
  `).run(userId, email, new Date().toISOString());
}

test('Sharing Gate (Feature 15): High-confidence scam payload is strictly blocked', async () => {
  const db = getDatabase(':memory:');
  createTestUser(db, 'user-sender-1', 'alice1@example.com');

  const scamContent = 'URGENT: Your bank account has been compromised. Please share your 6-digit OTP to unfreeze it now or police will be dispatched!';

  const result = await evaluateAndSendMessage({
    db,
    senderId: 'user-sender-1',
    senderEmail: 'alice1@example.com',
    recipientEmail: 'bob@example.com',
    content: scamContent,
    confirmSend: false
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'SCAM_CONTAINMENT_BLOCKED');
  assert.ok(result.riskScore >= 70);
  assert.ok(result.evidence.length > 0);
  assert.ok(result.remediationSteps.length > 0);

  // Check database persistence of blocked record
  const history = getUserSharedMessages({ db, userId: 'user-sender-1' });
  assert.equal(history.length, 1);
  assert.equal(history[0].status, 'blocked');
});

test('Sharing Gate (Feature 15): Borderline suspicious message requires warning acknowledgment', async () => {
  const db = getDatabase(':memory:');
  createTestUser(db, 'user-sender-2', 'alice2@example.com');

  // Borderline message: medium risk delivery notice without credential theft (score ~50)
  const borderlineContent = 'Urgent notice regarding your package delivery: http://tracking-hub.xyz/parcel';

  // Attempt without confirmation
  const unconfirmed = await evaluateAndSendMessage({
    db,
    senderId: 'user-sender-2',
    senderEmail: 'alice2@example.com',
    recipientEmail: 'charlie@example.com',
    content: borderlineContent,
    confirmSend: false
  });

  assert.equal(unconfirmed.success, false);
  assert.equal(unconfirmed.status, 'warning_required');
  assert.equal(unconfirmed.requiresConfirmation, true);

  // Now attempt with confirmSend: true
  const confirmed = await evaluateAndSendMessage({
    db,
    senderId: 'user-sender-2',
    senderEmail: 'alice2@example.com',
    recipientEmail: 'charlie@example.com',
    content: borderlineContent,
    confirmSend: true
  });

  assert.equal(confirmed.success, true);
  assert.equal(confirmed.status, 'warning_acknowledged');
});

test('Sharing Gate (Feature 15): Clean benign communication is delivered', async () => {
  const db = getDatabase(':memory:');
  createTestUser(db, 'user-sender-3', 'alice3@example.com');

  const cleanContent = 'Hi team, let us meet in conference room B at 4pm for the project review.';

  const result = await evaluateAndSendMessage({
    db,
    senderId: 'user-sender-3',
    senderEmail: 'alice3@example.com',
    recipientEmail: 'dave@example.com',
    content: cleanContent,
    confirmSend: false
  });

  assert.equal(result.success, true);
  assert.equal(result.status, 'allowed');
  assert.ok(result.riskScore < 40);
});

test('Sharing Gate (Feature 15): False-positive appeal flow', () => {
  const db = getDatabase(':memory:');
  createTestUser(db, 'user-sender-4', 'alice4@example.com');

  const appealRes = submitFalsePositiveAppeal({
    db,
    userId: 'user-sender-4',
    messageId: 'msg-blocked-123',
    reason: 'This message was a simulated red-team drill for internal training.'
  });

  assert.ok(appealRes.appealId);
  assert.equal(appealRes.status, 'pending');

  const appealRow = db.prepare('SELECT * FROM appeals WHERE id = ?').get(appealRes.appealId);
  assert.ok(appealRow);
  assert.equal(appealRow.message_id, 'msg-blocked-123');
});
