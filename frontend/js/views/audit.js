import { api } from '../api.js';

export async function renderAudit(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">🔍 Security Audit Logs</h2>
          <p class="card-desc">Feature 13: Immutable trail of security operations, authentication events, policy alterations, and containment triggers with privacy-by-design parameter masking.</p>
        </div>
        <button id="btn-refresh-audit" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">
          ↻ Refresh Logs
        </button>
      </div>

      <div id="audit-table-wrap">
        <p style="color: var(--text-muted); font-size: 13px;">Fetching security audit stream...</p>
      </div>
    </div>
  `;

  document.getElementById('btn-refresh-audit').addEventListener('click', () => loadAuditLogs());
  await loadAuditLogs();

  async function loadAuditLogs() {
    const wrap = document.getElementById('audit-table-wrap');
    try {
      const data = await api.getAuditLogs();
      const logs = data.logs || [];

      if (logs.length === 0) {
        wrap.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🛡️</div>
            <h4 class="empty-title">Audit Trail Clean</h4>
            <p class="empty-desc">No security exceptions or access violations recorded yet.</p>
          </div>
        `;
        return;
      }

      wrap.innerHTML = `
        <div style="overflow-x: auto;">
          <table class="cyber-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Client IP</th>
                <th>Details / Parameter Payload</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${logs
                .map(
                  (l) => `
                <tr>
                  <td>
                    <span class="engine-pill" style="font-family: var(--font-mono); font-weight: 600; color: ${
                      l.event_type.includes('fail') || l.event_type.includes('block')
                        ? 'var(--accent-crimson)'
                        : l.event_type.includes('revok') || l.event_type.includes('delete')
                        ? 'var(--accent-amber)'
                        : 'var(--accent-cyan)'
                    };">
                      ${l.event_type}
                    </span>
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 12px;">${l.ip_address || '127.0.0.1'}</td>
                  <td>
                    <code style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-secondary); word-break: break-all;">
                      ${JSON.stringify(l.details)}
                    </code>
                  </td>
                  <td style="color: var(--text-muted); font-size: 12px; white-space: nowrap;">
                    ${new Date(l.created_at).toLocaleString()}
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      wrap.innerHTML = `<p style="color: var(--accent-crimson); font-size: 13px;">Audit log fetch failed: ${err.message}</p>`;
    }
  }
}
