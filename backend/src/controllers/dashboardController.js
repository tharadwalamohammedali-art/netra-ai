export function handleGetDashboardMetrics({ db, userId }) {
  // 1. Total Scans
  const totalScansRow = db.prepare('SELECT COUNT(*) as count FROM scans WHERE user_id = ?').get(userId);
  const totalScans = totalScansRow ? totalScansRow.count : 0;

  // 2. Severity Breakdown (Low, Medium, High, Critical)
  const severityRows = db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM scans
    WHERE user_id = ?
    GROUP BY severity
  `).all(userId);

  const severityBreakdown = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0
  };
  for (const row of severityRows) {
    if (severityBreakdown[row.severity] !== undefined) {
      severityBreakdown[row.severity] = row.count;
    }
  }

  // 3. Scan Type Distribution (url, message, qr)
  const typeRows = db.prepare(`
    SELECT scan_type, COUNT(*) as count
    FROM scans
    WHERE user_id = ?
    GROUP BY scan_type
  `).all(userId);

  const typeDistribution = {
    url: 0,
    message: 0,
    qr: 0
  };
  for (const row of typeRows) {
    if (typeDistribution[row.scan_type] !== undefined) {
      typeDistribution[row.scan_type] = row.count;
    }
  }

  // 4. Frequently Detected Categories
  const categoryRows = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM scans
    WHERE user_id = ? AND severity IN ('Medium', 'High', 'Critical')
    GROUP BY category
    ORDER BY count DESC
    LIMIT 5
  `).all(userId);

  // 5. Active Threats / High-Risk Alerts count
  const activeAlerts = severityBreakdown.High + severityBreakdown.Critical;

  // 6. Recent Activity (latest 5 scans)
  const recentScans = db.prepare(`
    SELECT id, scan_type, target_preview, risk_score, severity, category, created_at
    FROM scans
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(userId);

  // 7. Containment Statistics
  const containmentRow = db.prepare(`
    SELECT 
      COUNT(*) as total_shared,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count,
      SUM(CASE WHEN status = 'warning_acknowledged' THEN 1 ELSE 0 END) as warned_count
    FROM shared_messages
    WHERE sender_id = ?
  `).get(userId);

  return {
    status: 200,
    data: {
      metrics: {
        totalScans,
        activeAlerts,
        severityBreakdown,
        typeDistribution,
        topCategories: categoryRows,
        containment: {
          totalShared: containmentRow?.total_shared || 0,
          blockedScams: containmentRow?.blocked_count || 0,
          warnedMessages: containmentRow?.warned_count || 0
        }
      },
      recentActivity: recentScans,
      isEmptyState: totalScans === 0
    }
  };
}
