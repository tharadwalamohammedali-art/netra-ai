import { api } from '../api.js';

export async function renderPrivacy(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">🔐 Privacy & Permission Center</h2>
          <p class="card-desc">Feature 8 & 11: Maintain absolute sovereignty over your data, review active permissions, configure zero-trust retention, and revoke integrations instantly.</p>
        </div>
      </div>

      <div id="privacy-loading" style="padding: 30px; text-align: center;">
        <p style="color: var(--text-muted);">Loading privacy controls...</p>
      </div>

      <div id="privacy-content" style="display: none;"></div>
    </div>
  `;

  await loadPrivacySettings();

  async function loadPrivacySettings() {
    const loadingEl = document.getElementById('privacy-loading');
    const contentEl = document.getElementById('privacy-content');

    try {
      const data = await api.getPrivacySettings();
      const { privacy, emailMonitoring, disclosures } = data;

      contentEl.innerHTML = `
        <!-- Local Processing & AI Engine Disclosure -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 8px;">
            🤖 AI Engine & Local Processing Architecture
          </h3>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 14px;">
            ${disclosures.localProcessing}
          </p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <span class="engine-pill" style="border-left: 3px solid var(--accent-emerald);">● Zero Cloud AI Transmission</span>
            <span class="engine-pill" style="border-left: 3px solid var(--accent-cyan);">● Gemma 3:1B Exclusively</span>
            <span class="engine-pill" style="border-left: 3px solid var(--accent-indigo);">● Explainable Deterministic Rules</span>
          </div>
        </div>

        <!-- Authorized Email Threat Monitoring (Feature 9) -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 700; color: #fff;">
                📬 Authorized Email Threat Monitoring
              </h3>
              <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                OAuth read-only access strictly for fraudulent invoice and credential phishing detection.
              </p>
            </div>
            <div>
              <span class="badge-severity ${emailMonitoring.enabled ? 'severity-Low' : 'severity-Medium'}">
                ${emailMonitoring.enabled ? 'INTEGRATION ACTIVE' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div style="background: var(--bg-card); padding: 12px 14px; border-radius: 6px; font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 16px;">
            <strong style="color: #fff;">Mandatory Disclosure:</strong> ${emailMonitoring.disclosure}
            <div style="margin-top: 6px; font-family: var(--font-mono); color: var(--accent-cyan); font-size: 11.5px;">
              Requested Scope: ${emailMonitoring.scope}
            </div>
          </div>

          ${
            emailMonitoring.enabled
              ? `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <span style="font-size: 13px; color: #fff;">
                Monitoring Account: <strong>${emailMonitoring.emailAddress}</strong>
              </span>
              <button id="btn-revoke-email" class="btn btn-danger" style="padding: 6px 14px; font-size: 12.5px;">
                Revoke Permissions & Erase Tokens
              </button>
            </div>
          `
              : `
            <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
              <input
                type="email"
                id="input-monitor-email"
                class="cyber-input"
                style="max-width: 320px;"
                placeholder="inbox@company.org"
              />
              <button id="btn-grant-email" class="btn btn-primary" style="padding: 8px 16px; font-size: 13px;">
                Grant Read-Only Consent
              </button>
            </div>
          `
          }
        </div>

        <!-- Data Retention & History Controls -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px;">
            ⏱️ Scan Telemetry Retention Policy
          </h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
            Specify how long NETRA AI retains your scan history before automated purging. Setting to 0 days immediately purges all past records.
          </p>

          <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
            <select id="select-retention-days" class="cyber-select" style="max-width: 220px;">
              <option value="30" ${privacy.historyRetentionDays === 30 ? 'selected' : ''}>30 Days (Standard)</option>
              <option value="7" ${privacy.historyRetentionDays === 7 ? 'selected' : ''}>7 Days (Short Term)</option>
              <option value="90" ${privacy.historyRetentionDays === 90 ? 'selected' : ''}>90 Days (Audit Safe)</option>
              <option value="365" ${privacy.historyRetentionDays === 365 ? 'selected' : ''}>365 Days (Extended)</option>
              <option value="0" ${privacy.historyRetentionDays === 0 ? 'selected' : ''}>0 Days (Immediate Purge)</option>
            </select>
            <button id="btn-save-retention" class="btn btn-secondary">
              Save Policy
            </button>
          </div>
        </div>

        <!-- Account Deletion -->
        <div style="border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 20px; background: rgba(239, 68, 68, 0.04);">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--accent-crimson); margin-bottom: 6px;">
            ⚠️ Danger Zone: Permanent Account Deletion
          </h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
            Permanently delete your profile, passwords, active sessions, scan telemetry, and transmission history. This action is irreversible.
          </p>
          <button id="btn-delete-account" class="btn btn-danger">
            🗑️ Permanently Delete Account & All Data
          </button>
        </div>
      `;

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';

      // Bind events
      document.getElementById('btn-grant-email')?.addEventListener('click', async () => {
        const email = document.getElementById('input-monitor-email').value.trim();
        if (!email) {
          alert('Please enter your email address to connect.');
          return;
        }
        try {
          await api.toggleEmailMonitoring(true, email);
          alert('Informed consent granted. Read-only threat monitoring enabled.');
          loadPrivacySettings();
        } catch (err) {
          alert(`Failed to enable: ${err.message}`);
        }
      });

      document.getElementById('btn-revoke-email')?.addEventListener('click', async () => {
        if (confirm('Revoke all email monitoring permissions and erase connection credentials?')) {
          try {
            await api.toggleEmailMonitoring(false);
            alert('Permissions revoked and credentials permanently purged.');
            loadPrivacySettings();
          } catch (err) {
            alert(`Failed to revoke: ${err.message}`);
          }
        }
      });

      document.getElementById('btn-save-retention')?.addEventListener('click', async () => {
        const days = parseInt(document.getElementById('select-retention-days').value, 10);
        try {
          await api.updatePrivacySettings(days, 'local_only');
          alert('Retention policy updated.');
          loadPrivacySettings();
        } catch (err) {
          alert(`Failed to update: ${err.message}`);
        }
      });

      document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
        const promptText = prompt('Type DELETE to permanently erase your NETRA AI account and data:');
        if (promptText === 'DELETE') {
          try {
            await api.deleteAccount();
            api.setToken(null);
            alert('Your account and all associated data have been deleted.');
            window.location.reload();
          } catch (err) {
            alert(`Deletion failed: ${err.message}`);
          }
        }
      });
    } catch (err) {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      contentEl.innerHTML = `<div class="toast toast-error">${err.message}</div>`;
    }
  }
}
