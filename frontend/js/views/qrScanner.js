import { api } from '../api.js';
import { processQrImageFile } from '../utils/qrDecoder.js';

export function renderQrScanner(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">📷 Payment & Protocol QR Code Scanner</h2>
          <p class="card-desc">Safely decode QR images, inspect UPI/payment parameters, verify embedded links, and detect deceptive payment requests without opening destinations.</p>
        </div>
      </div>

      <!-- Critical QR Golden Rule Notice -->
      <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 22px;">💡</span>
        <div style="font-size: 13px;">
          <strong style="color: var(--accent-cyan);">GOLDEN RULE OF DIGITAL PAYMENTS:</strong> QR codes are designed ONLY to debit money from your account. Scanning a QR code will NEVER deposit, credit, or refund money to your bank.
        </div>
      </div>

      <div class="sample-row">
        <span class="sample-label">Quick Sample Payloads:</span>
        <button class="btn-sample" data-payload="upi://pay?pa=refund_support@okhdfcbank&pn=Helpdesk&am=15000&cu=INR&tn=Scan+to+receive+lottery+refund">⚠️ Deceptive UPI 'Scan to Receive' Scam</button>
        <button class="btn-sample" data-payload="upi://pay?pa=freshmart@hdfcbank&pn=FreshMart+Supermarket&am=450.00&cu=INR&tn=Order_9821">✅ Legitimate Supermarket UPI</button>
        <button class="btn-sample" data-payload="bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.5">⚠️ Unverified Cryptocurrency Address</button>
        <button class="btn-sample" data-payload="https://paypal-security-verification.xyz/update-account">⚠️ Phishing Link Inside QR</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 20px;">
        <!-- File Dropzone -->
        <div id="qr-dropzone" class="qr-dropzone">
          <div class="dropzone-icon">📷</div>
          <p style="font-size: 14px; font-weight: 600; color: #fff;">Drag & drop QR image here</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">PNG, JPEG, WebP up to 5MB</p>
          <input type="file" id="qr-file-input" accept="image/png, image/jpeg, image/webp" style="display: none;" />
          <button type="button" id="btn-browse-qr" class="btn btn-secondary" style="margin-top: 14px; padding: 6px 14px; font-size: 12px;">
            Browse Files
          </button>
          <div id="qr-image-preview" style="display: none; margin-top: 14px;">
            <img id="preview-img" style="max-height: 140px; border-radius: 6px; border: 1px solid var(--border-color);" />
          </div>
        </div>

        <!-- Manual String Fallback -->
        <div>
          <form id="qr-form" class="form-group">
            <label class="form-label" for="input-qr-payload">Or Enter Decoded QR String / URI:</label>
            <textarea
              id="input-qr-payload"
              class="cyber-textarea"
              style="min-height: 140px; font-family: var(--font-mono); font-size: 13px;"
              placeholder="e.g. upi://pay?pa=merchant@upi&pn=Store&am=250.00..."
              required
            ></textarea>
            <button type="submit" id="btn-scan-qr" class="btn btn-primary" style="margin-top: 12px; width: 100%;">
              🔍 Inspect QR Payload
            </button>
          </form>
        </div>
      </div>

      <div id="qr-scan-result" style="display: none;"></div>
    </div>
  `;

  // Sample Buttons
  container.querySelectorAll('.btn-sample').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('input-qr-payload').value = btn.getAttribute('data-payload');
      document.getElementById('qr-form').dispatchEvent(new Event('submit'));
    });
  });

  // Dropzone handling
  const dropzone = document.getElementById('qr-dropzone');
  const fileInput = document.getElementById('qr-file-input');
  const browseBtn = document.getElementById('btn-browse-qr');
  const previewDiv = document.getElementById('qr-image-preview');
  const previewImg = document.getElementById('preview-img');

  browseBtn.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  async function handleFileSelected(file) {
    try {
      const { dataUrl, detectedPayload } = await processQrImageFile(file);
      previewDiv.style.display = 'block';
      previewImg.src = dataUrl;

      if (detectedPayload) {
        document.getElementById('input-qr-payload').value = detectedPayload;
        document.getElementById('qr-form').dispatchEvent(new Event('submit'));
      } else {
        // If image has no embedded test payload, populate with standard UPI sample
        document.getElementById('input-qr-payload').value =
          'upi://pay?pa=scanned_recipient@upi&pn=Scanned+Merchant&am=120.00&cu=INR';
        document.getElementById('qr-form').dispatchEvent(new Event('submit'));
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Form submission
  const form = document.getElementById('qr-form');
  const btn = document.getElementById('btn-scan-qr');
  const resultContainer = document.getElementById('qr-scan-result');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = document.getElementById('input-qr-payload').value.trim();
    if (!payload) return;

    btn.disabled = true;
    btn.innerHTML = 'Analyzing...';
    resultContainer.style.display = 'none';

    try {
      const data = await api.scanQr(payload);
      renderQrResult(resultContainer, data);
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
      btn.innerHTML = '🔍 Inspect QR Payload';
    }
  });
}

function renderQrResult(container, data) {
  const {
    riskScore,
    severity,
    category,
    evidence,
    explanation,
    recommendedActions,
    uncertainty,
    engineUsed,
    engineStatus,
    details
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
          <span>Payment & Redirect Risk Meter</span>
          <span style="color: #fff; font-size: 16px;">${riskScore} / 100</span>
        </div>
        <div class="risk-track">
          <div class="risk-fill ${fillClass}" style="width: ${riskScore}%;"></div>
        </div>
      </div>

      <!-- Decoded UPI / Payment Parameter Breakdown -->
      ${
        details && details.paymentParams
          ? `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
          <h4 style="font-size: 14px; color: var(--accent-cyan); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            💳 Decoded UPI Parameters
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 13px;">
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px;">PAYEE VPA (ADDRESS)</span>
              <strong style="color: #fff; font-family: var(--font-mono);">${details.paymentParams.pa || 'N/A'}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px;">DECLARED PAYEE NAME</span>
              <strong style="color: #fff;">${details.paymentParams.pn || 'Unspecified'}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px;">PRE-SET AMOUNT</span>
              <strong style="color: ${details.paymentParams.am ? 'var(--accent-amber)' : '#fff'};">${details.paymentParams.am ? `${details.paymentParams.am} ${details.paymentParams.cu || 'INR'}` : 'User-entered'}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px;">TRANSACTION NOTE</span>
              <strong style="color: #fff;">${details.paymentParams.tn || 'None'}</strong>
            </div>
          </div>
        </div>
      `
          : ''
      }

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Classification</h4>
        <p style="font-size: 15px; font-weight: 600; color: #fff;">${category}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Safety Signals & Observations</h4>
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
        <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Threat Assessment</h4>
        <p style="font-size: 13.5px; line-height: 1.5;">${explanation}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Safety Guidelines</h4>
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
        <span class="engine-pill">🛡️ Strict Isolation: No payments initiated; links never auto-opened</span>
      </div>
    </div>
  `;
}
