import crypto from 'node:crypto';
import { analyzeUrlDeterministically } from '../engines/urlScanner.js';
import { analyzeMessageDeterministically } from '../engines/messageScanner.js';
import { analyzeQrPayload } from '../engines/qrScanner.js';
import { queryGemma3 } from '../engines/gemmaAdapter.js';
import { logAuditEvent } from './auditService.js';

export async function executeScan({ userId, scanType, inputContent, clientIp = '127.0.0.1', db }) {
  if (!['url', 'message', 'qr'].includes(scanType)) {
    throw new Error(`Invalid scan type: ${scanType}. Must be 'url', 'message', or 'qr'.`);
  }

  // 1. Run deterministic explainable rules
  let deterministicResult;
  let targetPreview = '';

  if (scanType === 'url') {
    deterministicResult = analyzeUrlDeterministically(inputContent);
    targetPreview = inputContent.length > 100 ? `${inputContent.slice(0, 97)}...` : inputContent;
  } else if (scanType === 'message') {
    deterministicResult = analyzeMessageDeterministically(inputContent);
    targetPreview = inputContent.length > 80 ? `${inputContent.slice(0, 77)}...` : inputContent;
  } else if (scanType === 'qr') {
    deterministicResult = analyzeQrPayload(inputContent);
    targetPreview = inputContent.length > 80 ? `${inputContent.slice(0, 77)}...` : inputContent;
  }

  // 2. Query Gemma 3:1B Model Adapter
  const gemmaResult = await queryGemma3(scanType, inputContent, deterministicResult);

  // 3. Rule-Model Fusion:
  // Deterministic high-severity security rules always take precedence or raise risk
  // to prevent hallucination downplaying known threats.
  const finalRiskScore = Math.max(deterministicResult.riskScore, gemmaResult.risk_score);
  
  let finalSeverity = 'Low';
  if (finalRiskScore >= 70) finalSeverity = 'Critical';
  else if (finalRiskScore >= 45) finalSeverity = 'High';
  else if (finalRiskScore >= 20) finalSeverity = 'Medium';

  // Merge unique evidence
  const mergedEvidence = Array.from(new Set([...deterministicResult.evidence, ...(gemmaResult.evidence || [])]));
  const mergedActions = Array.from(
    new Set([...deterministicResult.recommendedActions, ...(gemmaResult.recommended_actions || [])])
  );

  const scanId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Save to SQLite
  const stmt = db.prepare(`
    INSERT INTO scans (
      id, user_id, scan_type, target_preview, risk_score, severity,
      category, evidence_json, explanation, recommended_actions_json,
      uncertainty, engine_used, engine_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    scanId,
    userId,
    scanType,
    targetPreview,
    finalRiskScore,
    finalSeverity,
    gemmaResult.suspected_category || deterministicResult.category,
    JSON.stringify(mergedEvidence),
    gemmaResult.explanation || deterministicResult.explanation,
    JSON.stringify(mergedActions),
    gemmaResult.uncertainty || deterministicResult.uncertainty,
    'Gemma 3:1B + Deterministic Rules',
    gemmaResult.engine_status,
    now
  );

  // Audit log
  logAuditEvent({
    db,
    userId,
    eventType: 'scan_executed',
    ipAddress: clientIp,
    details: {
      scanId,
      scanType,
      riskScore: finalRiskScore,
      severity: finalSeverity,
      category: gemmaResult.suspected_category || deterministicResult.category
    }
  });

  return {
    scanId,
    scanType,
    targetPreview,
    riskScore: finalRiskScore,
    severity: finalSeverity,
    category: gemmaResult.suspected_category || deterministicResult.category,
    evidence: mergedEvidence,
    explanation: gemmaResult.explanation || deterministicResult.explanation,
    recommendedActions: mergedActions,
    uncertainty: gemmaResult.uncertainty || deterministicResult.uncertainty,
    engineUsed: 'Gemma 3:1B + Deterministic Rules',
    engineStatus: gemmaResult.engine_status,
    createdAt: now,
    details: scanType === 'qr' ? deterministicResult.qrDetails : null
  };
}

export function getUserScans({ db, userId, limit = 50, offset = 0, scanType = null, severity = null }) {
  let query = 'SELECT * FROM scans WHERE user_id = ?';
  const params = [userId];

  if (scanType) {
    query += ' AND scan_type = ?';
    params.push(scanType);
  }
  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params);
  return rows.map((r) => ({
    ...r,
    evidence: JSON.parse(r.evidence_json || '[]'),
    recommended_actions: JSON.parse(r.recommended_actions_json || '[]')
  }));
}

export function getScanById({ db, userId, scanId }) {
  const row = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(scanId, userId);
  if (!row) return null;
  return {
    ...row,
    evidence: JSON.parse(row.evidence_json || '[]'),
    recommended_actions: JSON.parse(row.recommended_actions_json || '[]')
  };
}

export function deleteScan({ db, userId, scanId }) {
  const info = db.prepare('DELETE FROM scans WHERE id = ? AND user_id = ?').run(scanId, userId);
  return info.changes > 0;
}
