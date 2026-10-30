import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import { handleSignup, handleLogin } from '../src/controllers/authController.js';
import {
  handleScanUrl,
  handleScanMessage,
  handleScanQr,
  handleGetScans,
  handleGetScanDetails,
  handleExportScans
} from '../src/controllers/scanController.js';
import { handleGetDashboardMetrics } from '../src/controllers/dashboardController.js';
import { handleSendMessage, handleSubmitAppeal } from '../src/controllers/shareController.js';
import {
  handleGetPrivacySettings,
  handleUpdatePrivacySettings,
  handleToggleEmailMonitoring
} from '../src/controllers/privacyController.js';
import { handleGetAuditLogs } from '../src/controllers/auditController.js';

test('End-to-End Direct Integration Test: Complete User Journey', async () => {
  const db = getDatabase(':memory:');

  // 1. User Signup
  const signupRes = handleSignup({
    db,
    body: { email: 'chief_security_officer@netra.ai', password: 'SecurityMasterPassword2026!' },
    clientIp: '127.0.0.1'
  });
  assert.equal(signupRes.status, 201);
  const user = signupRes.data.user;
  const token = signupRes.data.token;
  assert.ok(token);

  // 2. User Login
  const loginRes = handleLogin({
    db,
    body: { email: 'chief_security_officer@netra.ai', password: 'SecurityMasterPassword2026!' },
    clientIp: '127.0.0.1'
  });
  assert.equal(loginRes.status, 200);

  // 3. Scan URL (Phishing / Brand Typosquat)
  const urlRes = await handleScanUrl({
    db,
    userId: user.id,
    body: { url: 'http://paypal-security-verification.xyz/login' },
    clientIp: '127.0.0.1'
  });
  assert.equal(urlRes.status, 200);
  assert.ok(urlRes.data.riskScore >= 70);
  assert.equal(urlRes.data.severity, 'Critical');
  assert.ok(urlRes.data.evidence.length > 0);
  const scanId1 = urlRes.data.scanId;

  // 4. Scan Message (OTP Credential Theft)
  const msgRes = await handleScanMessage({
    db,
    userId: user.id,
    body: { message: 'Dear Customer, your bank account has been locked. Share your 6-digit OTP code immediately.' },
    clientIp: '127.0.0.1'
  });
  assert.equal(msgRes.status, 200);
  assert.ok(msgRes.data.riskScore >= 70);
  assert.equal(msgRes.data.category, 'Credential & OTP Theft');
  const scanId2 = msgRes.data.scanId;

  // 5. Scan QR (Deceptive UPI "Scan to receive" scam)
  const qrRes = await handleScanQr({
    db,
    userId: user.id,
    body: { payload: 'upi://pay?pa=scam_support@okhdfcbank&pn=Helpdesk&am=15000&cu=INR&tn=Scan+to+receive+lottery+refund' },
    clientIp: '127.0.0.1'
  });
  assert.equal(qrRes.status, 200);
  assert.ok(qrRes.data.riskScore >= 70);
  assert.equal(qrRes.data.category, 'Deceptive Payment QR');
  assert.ok(qrRes.data.details.paymentParams.am === '15000');

  // 6. Dashboard Metrics
  const dashRes = handleGetDashboardMetrics({ db, userId: user.id });
  assert.equal(dashRes.status, 200);
  assert.equal(dashRes.data.metrics.totalScans, 3);
  assert.equal(dashRes.data.metrics.activeAlerts, 3);
  assert.equal(dashRes.data.isEmptyState, false);

  // 7. Scan History & Export
  const historyRes = handleGetScans({ db, userId: user.id, queryParams: { limit: 10 } });
  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.data.scans.length, 3);

  const detailRes = handleGetScanDetails({ db, userId: user.id, scanId: scanId1 });
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.data.scan.id, scanId1);

  const csvExport = handleExportScans({ db, userId: user.id, format: 'csv' });
  assert.equal(csvExport.status, 200);
  assert.ok(csvExport.data.includes('paypal-security-verification.xyz'));

  // 8. Feature 15 Containment Safety Gate: Attempting to send scam content
  const authContext = { userId: user.id, email: user.email, role: 'user' };

  const blockedSend = await handleSendMessage({
    db,
    user: authContext,
    body: {
      recipientEmail: 'victim@company.org',
      content: 'URGENT: Your account is compromised. Send your 6-digit OTP immediately!'
    },
    clientIp: '127.0.0.1'
  });
  assert.equal(blockedSend.status, 403);
  assert.equal(blockedSend.data.status, 'blocked');
  assert.ok(blockedSend.data.messageId);

  // 9. Feature 15 False Positive Appeal
  const appealRes = handleSubmitAppeal({
    db,
    user: authContext,
    body: {
      messageId: blockedSend.data.messageId,
      reason: 'Authorized simulated phishing assessment conducted by internal SOC.'
    }
  });
  assert.equal(appealRes.status, 201);
  assert.equal(appealRes.data.status, 'pending');

  // 10. Privacy & Consent Settings
  const privacyRes = handleGetPrivacySettings({ db, userId: user.id });
  assert.equal(privacyRes.status, 200);
  assert.equal(privacyRes.data.privacy.historyRetentionDays, 30);

  const emailConsentRes = handleToggleEmailMonitoring({
    db,
    userId: user.id,
    body: { enable: true, emailAddress: 'soc_team@netra.ai' },
    clientIp: '127.0.0.1'
  });
  assert.equal(emailConsentRes.status, 200);
  assert.equal(emailConsentRes.data.emailMonitoring.enabled, true);

  // 11. Security Audit Logs
  const auditRes = handleGetAuditLogs({ db, user: authContext });
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.data.logs.length >= 5);
  // Verify passwords or tokens are never leaked into audit logs
  for (const log of auditRes.data.logs) {
    assert.equal(log.details.password, undefined);
    assert.equal(log.details.token, undefined);
  }
});
