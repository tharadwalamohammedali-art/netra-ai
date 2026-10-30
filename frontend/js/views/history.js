import { api } from '../api.js';

export async function renderHistory(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">📜 Scan History & Reports</h2>
          <p class="card-desc">Review prior threat inspections, filter by severity or modality, export CSV/JSON compliance reports, or purge records.</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <a id="btn-export-json" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" download>
            📥 Export JSON
          </a>
          <a id="btn-export-csv" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" download>
            📊 Export CSV
          </a>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div style="display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap;">
        <input
          type="text"
          id="search-history"
          class="cyber-input"
          style="flex: 1; min-width: 220px;"
          placeholder="Search by category, domain, or preview..."
        />
        <select id="filter-type" class="cyber-select" style="width: 150px;">
          <option value="">All Types</option>
          <option value="url">URL Scans</option>
          <option value="message">Message Scans</option>
          <option value="qr">QR Scans</option>
        </select>
        <select id="filter-severity" class="cyber-select" style="width: 150px;">
          <option value="">All Severities</option>
          <option value="Low">Low Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="High">High Risk</option>
          <option value="Critical">Critical Risk</option>
        </select>
      </div>

      <div id="history-table-container">
        <p style="color: var(--text-muted); font-size: 13px;">Loading scan records...</p>
      </div>
    </div>

    <!-- Scan Detail Modal -->
    <div id="scan-detail-modal" class="modal-overlay" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <h3 id="modal-scan-title" style="font-size: 16px; font-weight: 700; color: #fff;">Scan Details</h3>
          <button id="btn-close-scan-modal" class="modal-close-btn">&times;</button>
        </div>
        <div id="modal-scan-body"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-export-json').href = api.getExportUrl('json');
  document.getElementById('btn-export-csv').href = api.getExportUrl('csv');

  const searchInput = document.getElementById('search-history');
  const typeFilter = document.getElementById('filter-type');
  const severityFilter = document.getElementById('filter-severity');
  const tableContainer = document.getElementById('history-table-container');

  let allScans = [];

  async function loadScans() {
    try {
      const type = typeFilter.value;
      const severity = severityFilter.value;
      const data = await api.getScans({ type, severity, limit: 100 });
      allScans = data.scans || [];
      renderTable();
    } catch (err) {
      tableContainer.innerHTML = `<p style="color: var(--accent-crimson); font-size: 13px;">Failed to load scans: ${err.message}</p>`;
    }
  }

  function renderTable() {
    const term = searchInput.value.toLowerCase().trim();
    const filtered = allScans.filter((s) => {
      if (!term) return true;
      return (
        (s.target_preview || '').toLowerCase().includes(term) ||
        (s.category || '').toLowerCase().includes(term) ||
        (s.explanation || '').toLowerCase().includes(term)
      );
    });

    if (filtered.length === 0) {
      tableContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <h4 class="empty-title">No Scans Found</h4>
          <p class="empty-desc">No scan records match the current filter criteria.</p>
        </div>
      `;
      return;
    }

    tableContainer.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="cyber-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Target Preview</th>
              <th>Suspected Category</th>
              <th>Risk Score</th>
              <th>Severity</th>
              <th>Timestamp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                (scan) => `
              <tr>
                <td><span class="engine-pill">${scan.scan_type.toUpperCase()}</span></td>
                <td style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${scan.target_preview}
                </td>
                <td>${scan.category}</td>
                <td><strong>${scan.risk_score}/100</strong></td>
                <td><span class="badge-severity severity-${scan.severity}">${scan.severity}</span></td>
                <td style="color: var(--text-muted); font-size: 12px;">${new Date(scan.created_at).toLocaleString()}</td>
                <td>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-view-scan" data-id="${scan.id}" style="padding: 4px 8px; font-size: 11px;">
                      View
                    </button>
                    <button class="btn btn-danger btn-delete-scan" data-id="${scan.id}" style="padding: 4px 8px; font-size: 11px;">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    // Bind view buttons
    tableContainer.querySelectorAll('.btn-view-scan').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const scan = allScans.find((s) => s.id === id);
        if (scan) openScanModal(scan);
      });
    });

    // Bind delete buttons
    tableContainer.querySelectorAll('.btn-delete-scan').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Permanently delete this scan record from your encrypted history?')) {
          try {
            await api.deleteScan(id);
            allScans = allScans.filter((s) => s.id !== id);
            renderTable();
          } catch (err) {
            alert(`Delete failed: ${err.message}`);
          }
        }
      });
    });
  }

  // Modal logic
  const modal = document.getElementById('scan-detail-modal');
  const modalBody = document.getElementById('modal-scan-body');
  const closeBtn = document.getElementById('btn-close-scan-modal');

  function openScanModal(scan) {
    modalBody.innerHTML = `
      <div style="margin-bottom: 14px;">
        <span class="badge-severity severity-${scan.severity}" style="margin-bottom: 10px;">${scan.severity} Severity</span>
        <h4 style="font-size: 15px; color: #fff; margin-top: 6px;">${scan.category}</h4>
        <p style="font-size: 12px; color: var(--text-muted);">Scan ID: ${scan.id} | ${scan.created_at}</p>
      </div>

      <div style="background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin-bottom: 14px;">
        <span style="font-size: 11px; color: var(--text-muted); display: block;">TARGET ANALYZED:</span>
        <code style="font-family: var(--font-mono); font-size: 12.5px; word-break: break-all; color: var(--accent-cyan);">${scan.target_preview}</code>
      </div>

      <div style="margin-bottom: 14px;">
        <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">OBSERVED EVIDENCE SIGNALS:</span>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
          ${(scan.evidence || []).map((e) => `<li style="background: var(--bg-card); padding: 6px 10px; border-radius: 4px;">🔍 ${e}</li>`).join('')}
        </ul>
      </div>

      <div style="margin-bottom: 14px;">
        <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">EXPLANATION & REASONING:</span>
        <p style="font-size: 13px; line-height: 1.5; color: var(--text-secondary);">${scan.explanation}</p>
      </div>

      <div style="margin-bottom: 14px;">
        <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">PROTECTIVE RECOMMENDATIONS:</span>
        <ul style="font-size: 13px; color: var(--text-primary); padding-left: 18px;">
          ${(scan.recommended_actions || []).map((a) => `<li>${a}</li>`).join('')}
        </ul>
      </div>

      <div class="engine-specs">
        <span class="engine-pill">🤖 ${scan.engine_used}</span>
        <span class="engine-pill">Status: ${scan.engine_status}</span>
        <span class="engine-pill">Uncertainty: ${scan.uncertainty}</span>
      </div>
    `;
    modal.style.display = 'flex';
  }

  closeBtn.addEventListener('click', () => (modal.style.display = 'none'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', loadScans);
  severityFilter.addEventListener('change', loadScans);

  await loadScans();
}
