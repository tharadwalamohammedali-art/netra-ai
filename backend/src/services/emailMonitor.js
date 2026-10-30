import { logAuditEvent } from './auditService.js';
import { analyzeMessageDeterministically } from '../engines/messageScanner.js';
import { queryGemma3 } from '../engines/gemmaAdapter.js';

export const EMAIL_MONITORING_CONFIG = {
  REQUIRED_SCOPE: 'https://www.googleapis.com/auth/gmail.readonly',
  PERMISSION_NAME: 'Read-Only Inbox Message Inspection',
  DISCLOSURE: 'NETRA AI accesses incoming message headers and text solely to check for fraudulent invoices, phishing links, and sender impersonation. NETRA AI CANNOT and WILL NEVER send, modify, or delete your emails. All processing is local or user-controlled.',
  CONFIGURED: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
};

export function getEmailMonitoringStatus({ db, userId }) {
  const row = db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(userId);
  if (!row) {
    return {
      enabled: false,
      configuredInEnvironment: EMAIL_MONITORING_CONFIG.CONFIGURED,
      emailAddress: null,
      scope: EMAIL_MONITORING_CONFIG.REQUIRED_SCOPE,
      disclosure: EMAIL_MONITORING_CONFIG.DISCLOSURE,
      lastSynced: null
    };
  }

  return {
    enabled: Boolean(row.email_monitoring_enabled),
    configuredInEnvironment: EMAIL_MONITORING_CONFIG.CONFIGURED,
    emailAddress: row.email_address,
    scope: row.email_oauth_scope || EMAIL_MONITORING_CONFIG.REQUIRED_SCOPE,
    disclosure: EMAIL_MONITORING_CONFIG.DISCLOSURE,
    lastSynced: row.email_last_synced
  };
}

export function updateEmailMonitoringConsent({ db, userId, enable, emailAddress = null, clientIp = '127.0.0.1' }) {
  const now = new Date().toISOString();

  // Ensure record exists
  const existing = db.prepare('SELECT user_id FROM privacy_settings WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare(`
      INSERT INTO privacy_settings (
        user_id, history_retention_days, processing_mode, consent_given,
        email_monitoring_enabled, email_address, email_oauth_scope, email_last_synced, updated_at
      ) VALUES (?, 30, 'local_only', 1, ?, ?, ?, ?, ?)
    `).run(
      userId,
      enable ? 1 : 0,
      enable ? emailAddress : null,
      enable ? EMAIL_MONITORING_CONFIG.REQUIRED_SCOPE : null,
      enable ? now : null,
      now
    );
  } else {
    db.prepare(`
      UPDATE privacy_settings
      SET email_monitoring_enabled = ?,
          email_address = ?,
          email_oauth_scope = ?,
          email_last_synced = ?,
          updated_at = ?
      WHERE user_id = ?
    `).run(
      enable ? 1 : 0,
      enable ? emailAddress : null,
      enable ? EMAIL_MONITORING_CONFIG.REQUIRED_SCOPE : null,
      enable ? now : null,
      now,
      userId
    );
  }

  logAuditEvent({
    db,
    userId,
    eventType: enable ? 'email_monitoring_enabled' : 'email_monitoring_revoked',
    ipAddress: clientIp,
    details: {
      enabled: enable,
      scope: EMAIL_MONITORING_CONFIG.REQUIRED_SCOPE
    }
  });

  return getEmailMonitoringStatus({ db, userId });
}

/**
 * Simulate an on-demand inspection of an authorized sample inbox item
 */
export async function inspectAuthorizedEmailItem({ db, userId, subject, sender, body }) {
  const status = getEmailMonitoringStatus({ db, userId });
  if (!status.enabled) {
    throw new Error('Email monitoring is currently disabled. Explicit consent must be granted first.');
  }

  const combinedContent = `From: ${sender}\nSubject: ${subject}\n\n${body}`;
  const deterministicResult = analyzeMessageDeterministically(combinedContent);
  const gemmaResult = await queryGemma3('email', combinedContent, deterministicResult);

  const finalRisk = Math.max(deterministicResult.riskScore, gemmaResult.risk_score);

  return {
    subject,
    sender,
    riskScore: finalRisk,
    severity: finalRisk >= 70 ? 'Critical' : finalRisk >= 45 ? 'High' : finalRisk >= 20 ? 'Medium' : 'Low',
    category: gemmaResult.suspected_category || deterministicResult.category,
    evidence: [...deterministicResult.evidence, ...(gemmaResult.evidence || [])],
    explanation: gemmaResult.explanation || deterministicResult.explanation,
    recommendedActions: deterministicResult.recommendedActions
  };
}
