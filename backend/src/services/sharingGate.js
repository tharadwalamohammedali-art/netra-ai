import crypto from 'node:crypto';
import { analyzeMessageDeterministically } from '../engines/messageScanner.js';
import { analyzeUrlDeterministically } from '../engines/urlScanner.js';
import { queryGemma3 } from '../engines/gemmaAdapter.js';
import { logAuditEvent } from './auditService.js';

export const CONTAINMENT_POLICY = {
  HIGH_RISK_THRESHOLD: 70, // >= 70 is blocked unconditionally
  MEDIUM_RISK_THRESHOLD: 40, // 40-69 requires explicit user confirmation
  FAIL_SAFE_DEFAULT_BLOCKED: false // If offline, requires user acknowledgment
};

/**
 * Server-side enforced safety gate for internal message/sharing
 */
export async function evaluateAndSendMessage({
  db,
  senderId,
  senderEmail,
  recipientEmail,
  content,
  confirmSend = false,
  clientIp = '127.0.0.1'
}) {
  if (!content || typeof content !== 'string' || !content.trim()) {
    return {
      success: false,
      status: 'rejected',
      code: 'EMPTY_CONTENT',
      message: 'Message content cannot be blank.'
    };
  }

  const trimmed = content.trim();

  // 1. Run deterministic checks for messages and any embedded URLs
  const msgAnalysis = analyzeMessageDeterministically(trimmed);
  let highestUrlRisk = 0;
  let urlEvidence = [];

  const urlMatches = trimmed.match(/https?:\/\/[^\s]+/gi) || [];
  for (const url of urlMatches) {
    const urlAnalysis = analyzeUrlDeterministically(url);
    if (urlAnalysis.riskScore > highestUrlRisk) {
      highestUrlRisk = urlAnalysis.riskScore;
    }
    urlEvidence = urlEvidence.concat(urlAnalysis.evidence);
  }

  // 2. Query Gemma 3:1B adapter
  const gemmaAnalysis = await queryGemma3('message', trimmed, msgAnalysis);

  // 3. Fused risk calculation
  const compositeRisk = Math.max(msgAnalysis.riskScore, highestUrlRisk, gemmaAnalysis.risk_score);

  let compositeSeverity = 'Low';
  if (compositeRisk >= 70) compositeSeverity = 'Critical';
  else if (compositeRisk >= 45) compositeSeverity = 'High';
  else if (compositeRisk >= 20) compositeSeverity = 'Medium';

  const mergedEvidence = Array.from(
    new Set([...msgAnalysis.evidence, ...urlEvidence, ...(gemmaAnalysis.evidence || [])])
  );

  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();
  const snippet = trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed;

  // 4. Server-Side Enforcement Gate

  // RULE A: High-confidence malicious threat -> BLOCK
  if (compositeRisk >= CONTAINMENT_POLICY.HIGH_RISK_THRESHOLD || compositeSeverity === 'Critical') {
    const blockedReason = `High-confidence scam or malicious payload detected (${compositeRisk}/100, severity: ${compositeSeverity}).`;

    // Persist blocked attempt
    db.prepare(`
      INSERT INTO shared_messages (
        id, sender_id, recipient_email, content_snippet, status, risk_score, severity, blocked_reason, created_at
      ) VALUES (?, ?, ?, ?, 'blocked', ?, ?, ?, ?)
    `).run(messageId, senderId, recipientEmail, snippet, compositeRisk, compositeSeverity, blockedReason, now);

    logAuditEvent({
      db,
      userId: senderId,
      eventType: 'message_blocked_containment',
      ipAddress: clientIp,
      details: {
        messageId,
        recipientEmail,
        riskScore: compositeRisk,
        severity: compositeSeverity,
        category: gemmaAnalysis.suspected_category || msgAnalysis.category,
        evidenceCount: mergedEvidence.length
      }
    });

    return {
      success: false,
      status: 'blocked',
      messageId,
      code: 'SCAM_CONTAINMENT_BLOCKED',
      riskScore: compositeRisk,
      severity: compositeSeverity,
      category: gemmaAnalysis.suspected_category || msgAnalysis.category,
      evidence: mergedEvidence,
      message: 'This message was blocked by NETRA AI Scam Containment to prevent the distribution of confirmed fraud indicators.',
      remediationSteps: [
        'Do not forward OTPs, payment links, or unverified prize notifications.',
        'If you believe this message was flagged in error, you may submit a false-positive appeal below for review.',
        'Note: NETRA AI only regulates content shared within its own platform and does not monitor or alter third-party apps like WhatsApp or carrier SMS.'
      ]
    };
  }

  // RULE B: Borderline / Medium threat -> Require explicit user confirmation
  if (compositeRisk >= CONTAINMENT_POLICY.MEDIUM_RISK_THRESHOLD && !confirmSend) {
    return {
      success: false,
      status: 'warning_required',
      messageId,
      code: 'SUSPICIOUS_CONTENT_WARNING',
      riskScore: compositeRisk,
      severity: compositeSeverity,
      category: gemmaAnalysis.suspected_category || msgAnalysis.category,
      evidence: mergedEvidence,
      message: 'Suspicious elements were detected in this message. Please review the flagged evidence and confirm if you still wish to send.',
      requiresConfirmation: true
    };
  }

  // RULE C: Clean or confirmed warning -> ALLOW
  const status = compositeRisk >= CONTAINMENT_POLICY.MEDIUM_RISK_THRESHOLD ? 'warning_acknowledged' : 'allowed';

  db.prepare(`
    INSERT INTO shared_messages (
      id, sender_id, recipient_email, content_snippet, status, risk_score, severity, blocked_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).run(messageId, senderId, recipientEmail, snippet, status, compositeRisk, compositeSeverity, now);

  logAuditEvent({
    db,
    userId: senderId,
    eventType: 'message_sent',
    ipAddress: clientIp,
    details: {
      messageId,
      recipientEmail,
      status,
      riskScore: compositeRisk
    }
  });

  return {
    success: true,
    status,
    messageId,
    riskScore: compositeRisk,
    severity: compositeSeverity,
    message: 'Message delivered securely through NETRA AI containment channel.'
  };
}

export function submitFalsePositiveAppeal({ db, userId, messageId, reason }) {
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new Error('Appeal reason must provide at least 5 characters explaining why the content is safe.');
  }

  const appealId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO appeals (id, message_id, user_id, reason, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(appealId, messageId, userId, reason.trim(), now);

  logAuditEvent({
    db,
    userId,
    eventType: 'appeal_submitted',
    details: { appealId, messageId }
  });

  return {
    appealId,
    messageId,
    status: 'pending',
    message: 'Your appeal has been received and queued for security review.'
  };
}

export function getUserSharedMessages({ db, userId, limit = 50 }) {
  const rows = db.prepare(`
    SELECT * FROM shared_messages
    WHERE sender_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);
  return rows;
}
