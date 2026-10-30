import { api } from '../api.js';

export function renderUrlScanner(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">🔗 Smart URL & Phishing Scanner</h2>
          <p class="card-desc">Inspect domain spelling, Cyrillic lookalike characters, suspicious subdomains, misleading paths, and SSRF indicators before opening.</p>
        </div>
      </div>

      <div class="sample-row">
        <span class="sample-label">Quick Test Samples:</span>
        <button class="btn-sample" data-url="http://paypal-security-verification.xyz/update">⚠️ PayPal Phishing Typosquat</button>
        <button class="btn-sample" data-url="https://\u0430pple.com/login">⚠️ Cyrillic 'а' Homoglyph Spoof</button>
        <button class="btn-sample" data-url="http://192.168.1.1/admin">🚫 SSRF Private Network Block</button>
        <button class="btn-sample" data-url="https://github.com/torvalds/linux">✅ Legitimate Official Domain</button>
      </div>

      <form id="url-scan-form" class="form-group">
        <label class="form-label" for="input-url">Target URL to inspect:</label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <input
            type="text"
            id="input-url"
            class="cyber-input"
            style="flex: 1; min-width: 280px;"
            placeholder="e.g. https://secure-login.bank-portal.xyz/verify"
            required
            autocomplete="off"
          />
          <button type="submit" id="btn-scan-url" class="btn btn-primary">
            🔍 Analyze URL
          </button>
        </div>
      </form>

      <div id="url-scan-result" style="display: none;"></div>
    </div>
  `;

  // Sample buttons
  container.querySelectorAll('.btn-sample').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('input-url').value = btn.getAttribute('data-url');
      document.getElementById('url-scan-form').dispatchEvent(new Event('submit'));
    });
  });

  const form = document.getElementById('url-scan-form');
  const btn = document.getElementById('btn-scan-url');
  const resultContainer = document.getElementById('url-scan-result');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('input-url').value.trim();
    if (!url) return;

    btn.disabled = true;
    btn.innerHTML = 'Analyzing...';
    resultContainer.style.display = 'none';

    try {
      const data = await api.scanUrl(url);
      renderScanResult(resultContainer, data);
    } catch (err) {
      resultContainer.style.display = 'block';
      resultContainer.innerHTML = `
        <div class="result-box" style="border-left: 4px solid var(--accent-crimson);">
          <h4 style="color: var(--accent-crimson);">Scan Failed</h4>
          <p style="margin-top: 6px; font-size: 13.5px;">${err.message}</p>
        </div>
      `;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔍 Analyze URL';
    }
  });
}

function renderScanResult(container, data) {
  const {
    riskScore,
    severity,
    category,
    evidence,
    explanation,
    recommendedActions,
    uncertainty,
    engineUsed,
    engineStatus
  } = data;

  const fillClass =
    riskScore >= 70
      ? 'risk-fill-critical'
      : riskScore >= 45
      ? 'risk-fill-high'
      : riskScore >= 20
      ? 'risk-fill-med'
      : 'risk-fill-low';

  container.style.display = 'block';
  container.innerHTML = `
    <div class="result-box">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <span class="badge-severity severity-${severity}">${severity} Risk</span>
        <span style="font-size: 13px; color: var(--text-muted);">Uncertainty Level: <strong>${uncertainty}</strong></span>
      </div>

      <div class="risk-meter-wrap">
        <div class="risk-meter-labels">
          <span>Overall Fraud & Threat Risk Score</span>
          <span style="color: #fff; font-size: 16px;">${riskScore} / 100</span>
        </div>
        <div class="risk-track">
          <div class="risk-fill ${fillClass}" style="width: ${riskScore}%;"></div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Identified Category</h4>
        <p style="font-size: 15px; font-weight: 600; color: #fff;">${category}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Explainable Evidence Signals</h4>
        <ul class="evidence-list">
          ${evidence
            .map(
              (item) => `
            <li class="evidence-item ${riskScore >= 50 ? 'threat' : riskScore >= 20 ? 'warning' : 'safe'}">
              <span>${riskScore >= 50 ? '⚠️' : riskScore >= 20 ? '🔍' : '✓'}</span>
              <span>${item}</span>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>

      <div style="margin-bottom: 16px; background: var(--bg-card); padding: 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-indigo);">
        <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Analysis Summary</h4>
        <p style="font-size: 13.5px; line-height: 1.5;">${explanation}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Recommended Protective Actions</h4>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px;">
          ${recommendedActions
            .map(
              (act) => `
            <li style="font-size: 13px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--accent-cyan);">→</span> ${act}
            </li>
          `
            )
            .join('')}
        </ul>
      </div>

      <div class="engine-specs">
        <span class="engine-pill">🤖 ${engineUsed}</span>
        <span class="engine-pill">📡 Engine Status: ${engineStatus}</span>
        <span class="engine-pill">🔒 Privacy: Zero External Third-Party Cloud AI Sharing</span>
      </div>
    </div>
  `;
}
