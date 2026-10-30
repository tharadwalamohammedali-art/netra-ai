import { api } from '../api.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">🛡️ Security Command Center</h2>
          <p class="card-desc">Real-time threat metrics, scan history insights, and active containment status.</p>
        </div>
        <button id="btn-refresh-dashboard" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">
          ↻ Refresh
        </button>
      </div>

      <div id="dashboard-loading" style="text-align:center; padding: 40px;">
        <div style="font-size: 24px; animation: spin 1s linear infinite; display: inline-block;">⟳</div>
        <p style="color: var(--text-muted); margin-top: 10px;">Aggregating stored telemetry records...</p>
      </div>

      <div id="dashboard-content" style="display: none;"></div>
    </div>
  `;

  document.getElementById('btn-refresh-dashboard').addEventListener('click', () => loadMetrics());
  await loadMetrics();

  async function loadMetrics() {
    const loadingEl = document.getElementById('dashboard-loading');
    const contentEl = document.getElementById('dashboard-content');
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';

    try {
      const data = await api.getDashboardMetrics();
      const { metrics, recentActivity, isEmptyState } = data;

      if (isEmptyState) {
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🛡️</div>
            <h3 class="empty-title">No Scans Recorded Yet</h3>
            <p class="empty-desc">Run your first URL, message, or QR code scan to populate your security telemetry with real, transparent data.</p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="window.netraRouter.navigate('url-scanner')">🔗 Scan a Suspicious URL</button>
              <button class="btn btn-secondary" onclick="window.netraRouter.navigate('message-scanner')">✉️ Scan an SMS / Message</button>
              <button class="btn btn-secondary" onclick="window.netraRouter.navigate('qr-scanner')">📷 Scan a Payment QR</button>
            </div>
          </div>
        `;
        return;
      }

      const total = metrics.totalScans || 1;
      const lowPct = Math.round((metrics.severityBreakdown.Low / total) * 100);
      const medPct = Math.round((metrics.severityBreakdown.Medium / total) * 100);
      const highPct = Math.round((metrics.severityBreakdown.High / total) * 100);
      const critPct = Math.round((metrics.severityBreakdown.Critical / total) * 100);

      contentEl.innerHTML = `
        <!-- KPI Metrics Grid -->
        <div class="metrics-grid">
          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-icon-cyan">📊</div>
            <div class="kpi-data">
              <div class="kpi-num">${metrics.totalScans}</div>
              <div class="kpi-label">Total Verified Scans</div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-icon-crimson">⚠️</div>
            <div class="kpi-data">
              <div class="kpi-num">${metrics.activeAlerts}</div>
              <div class="kpi-label">Active High/Critical Threats</div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-icon-emerald">🛡️</div>
            <div class="kpi-data">
              <div class="kpi-num">${metrics.containment.blockedScams}</div>
              <div class="kpi-label">Internal Scams Contained</div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap kpi-icon-amber">🤖</div>
            <div class="kpi-data">
              <div class="kpi-num">Gemma 3:1B</div>
              <div class="kpi-label">Inference Engine Active</div>
            </div>
          </div>
        </div>

        <!-- Severity & Category Split -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 28px;">
          <!-- Severity Distribution -->
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
            <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 16px; color: #fff;">Risk Severity Distribution</h3>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                  <span style="color: var(--accent-emerald);">● Low Risk</span>
                  <span>${metrics.severityBreakdown.Low} (${lowPct}%)</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${lowPct}%; height: 100%; background: var(--accent-emerald);"></div>
                </div>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                  <span style="color: var(--accent-amber);">● Medium Risk</span>
                  <span>${metrics.severityBreakdown.Medium} (${medPct}%)</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${medPct}%; height: 100%; background: var(--accent-amber);"></div>
                </div>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                  <span style="color: #f97316;">● High Risk</span>
                  <span>${metrics.severityBreakdown.High} (${highPct}%)</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${highPct}%; height: 100%; background: #f97316;"></div>
                </div>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                  <span style="color: var(--accent-crimson);">● Critical Risk</span>
                  <span>${metrics.severityBreakdown.Critical} (${critPct}%)</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${critPct}%; height: 100%; background: var(--accent-crimson);"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Threat Categories -->
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
            <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 16px; color: #fff;">Top Detected Threat Vectors</h3>
            ${
              metrics.topCategories && metrics.topCategories.length > 0
                ? `<ul style="list-style: none; display: flex; flex-direction: column; gap: 10px;">
                    ${metrics.topCategories
                      .map(
                        (cat) => `
                      <li style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-card); border-radius: 4px; font-size: 13px;">
                        <span>⚠️ ${cat.category}</span>
                        <span style="font-weight: 700; color: var(--accent-cyan);">${cat.count} scan(s)</span>
                      </li>
                    `
                      )
                      .join('')}
                   </ul>`
                : `<p style="font-size: 13px; color: var(--text-muted);">No high-risk categories detected yet.</p>`
            }
          </div>
        </div>

        <!-- Recent Activity Feed -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <h3 style="font-size: 15px; font-weight: 700;">Recent Scans</h3>
            <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="window.netraRouter.navigate('history')">
              View All Scans →
            </button>
          </div>

          <div style="overflow-x: auto;">
            <table class="cyber-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Target / Preview</th>
                  <th>Category</th>
                  <th>Risk Score</th>
                  <th>Severity</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                ${recentActivity
                  .map(
                    (item) => `
                  <tr>
                    <td><span class="engine-pill">${item.scan_type.toUpperCase()}</span></td>
                    <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${item.target_preview}
                    </td>
                    <td>${item.category}</td>
                    <td><strong style="color: ${item.risk_score >= 70 ? 'var(--accent-crimson)' : item.risk_score >= 45 ? '#f97316' : item.risk_score >= 20 ? 'var(--accent-amber)' : 'var(--accent-emerald)'}">${item.risk_score}/100</strong></td>
                    <td><span class="badge-severity severity-${item.severity}">${item.severity}</span></td>
                    <td style="color: var(--text-muted); font-size: 12px;">${new Date(item.created_at).toLocaleTimeString()}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    } catch (err) {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      contentEl.innerHTML = `<div class="toast toast-error">${err.message}</div>`;
    }
  }
}
