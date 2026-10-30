import crypto from 'node:crypto';

export function logAuditEvent({ db, userId = null, eventType, ipAddress = '127.0.0.1', details = {} }) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Sanitize details to ensure passwords, tokens, or private keys are never recorded
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.token;
    delete safeDetails.authorization;
    delete safeDetails.cookie;

    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, event_type, ip_address, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, eventType, ipAddress, JSON.stringify(safeDetails), now);
    return id;
  } catch (err) {
    // Audit logging failure should not crash the request, but log to stderr
    console.error('Failed to write audit log:', err.message);
    return null;
  }
}

export function getAuditLogs({ db, userId = null, limit = 50 }) {
  let query = 'SELECT * FROM audit_logs';
  const params = [];

  if (userId) {
    query += ' WHERE user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(query).all(...params);
  return rows.map((r) => ({
    ...r,
    details: JSON.parse(r.details_json || '{}')
  }));
}
