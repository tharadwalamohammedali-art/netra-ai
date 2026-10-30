import {
  getEmailMonitoringStatus,
  updateEmailMonitoringConsent
} from '../services/emailMonitor.js';
import { logAuditEvent } from '../services/auditService.js';

export function handleGetPrivacySettings({ db, userId }) {
  let settings = db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(userId);

  if (!settings) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO privacy_settings (
        user_id, history_retention_days, processing_mode, consent_given,
        email_monitoring_enabled, updated_at
      ) VALUES (?, 30, 'local_only', 1, 0, ?)
    `).run(userId, now);
    settings = db.prepare('SELECT * FROM privacy_settings WHERE user_id = ?').get(userId);
  }

  const emailStatus = getEmailMonitoringStatus({ db, userId });

  return {
    status: 200,
    data: {
      privacy: {
        historyRetentionDays: settings.history_retention_days,
        processingMode: settings.processing_mode,
        consentGiven: Boolean(settings.consent_given),
        updatedAt: settings.updated_at
      },
      emailMonitoring: emailStatus,
      disclosures: {
        localProcessing: 'All URL, message, and QR scanning runs locally using deterministic rules and local Gemma 3:1B inference.',
        thirdPartySharing: 'Zero user data, messages, or URLs are sent to external cloud AI providers or advertising networks.',
        revocationPolicy: 'Revoking permissions immediately removes credentials and deactivates any background integration.'
      }
    }
  };
}

export function handleUpdatePrivacySettings({ db, userId, body, clientIp }) {
  const { historyRetentionDays, processingMode } = body || {};

  const days = parseInt(historyRetentionDays, 10);
  if (isNaN(days) || ![7, 30, 90, 365, 0].includes(days)) {
    return {
      status: 400,
      data: { error: 'Retention days must be 0 (do not retain), 7, 30, 90, or 365.' }
    };
  }

  const mode = processingMode === 'standard' ? 'standard' : 'local_only';
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE privacy_settings
    SET history_retention_days = ?,
        processing_mode = ?,
        updated_at = ?
    WHERE user_id = ?
  `).run(days, mode, now, userId);

  // If retention days is 0, immediately purge history
  if (days === 0) {
    db.prepare('DELETE FROM scans WHERE user_id = ?').run(userId);
  }

  logAuditEvent({
    db,
    userId,
    eventType: 'privacy_settings_updated',
    ipAddress: clientIp,
    details: { historyRetentionDays: days, processingMode: mode }
  });

  return {
    status: 200,
    data: { message: 'Privacy settings updated successfully.' }
  };
}

export function handleToggleEmailMonitoring({ db, userId, body, clientIp }) {
  const { enable, emailAddress } = body || {};

  if (enable && (!emailAddress || !emailAddress.includes('@'))) {
    return { status: 400, data: { error: 'A valid email address is required to enable inbox threat monitoring.' } };
  }

  const updatedStatus = updateEmailMonitoringConsent({
    db,
    userId,
    enable: Boolean(enable),
    emailAddress: enable ? emailAddress.trim() : null,
    clientIp
  });

  return {
    status: 200,
    data: {
      message: enable
        ? 'Authorized email threat monitoring enabled with read-only permissions.'
        : 'Authorized email threat monitoring disabled and credentials revoked.',
      emailMonitoring: updatedStatus
    }
  };
}
