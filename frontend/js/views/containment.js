import { api } from '../api.js';

export async function renderContainment(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">🛡️ Scam Containment & Spam-Spread Safety Gate</h2>
          <p class="card-desc">Feature 15: Server-side safety gate for NETRA AI's internal sharing platform. Scans content at dispatch time to stop high-confidence fraud dissemination.</p>
        </div>
      </div>

      <!-- Mandatory Scope & Authority Disclosure -->
      <div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 20px; font-size: 13px;">
        <strong style="color: var(--accent-indigo);">SCOPE BOUNDARY DISCLOSURE:</strong> This safety gate strictly inspects and intercepts communications sent through <em>NETRA AI's own sharing endpoints</em>. NETRA AI makes <strong>no claim</strong> to block or intercept messages within WhatsApp, standard cellular SMS, or third-party messengers without direct platform carrier integration.
      </div>

      <div class="sample-row">
        <span class="sample-label">Simulate Outgoing Messages:</span>
        <button class="btn-sample" data-sim="scam">🚫 Send Malicious OTP Harvester (Triggers Block)</button>
        <button class="btn-sample" data-sim="borderline">⚠️ Send Borderline Delivery Notice (Triggers Warning)</button>
        <button class="btn-sample" data-sim="clean">✅ Send Safe Collaboration Update (Delivers)</button>
      </div>

      <form id="share-form" class="form-group">
        <div style="margin-bottom: 14px;">
          <label class="form-label" for="share-recipient">Recipient Email:</label>
          <input
            type="email"
            id="share-recipient"
            class="cyber-input"
            value="teammate@company.org"
            required
          />
        </div>

        <div style="margin-bottom: 14px;">
          <label class="form-label" for="share-content">Message Content to Share:</label>
          <textarea
            id="share-content"
            class="cyber-textarea"
            placeholder="Type message to transmit..."
            required
          ></textarea>
        </div>

        <button type="submit" id="btn-submit-share" class="btn btn-primary">
          📤 Send Message (Passes Server-Side Gate)
        </button>
      </form>

      <div id="containment-status" style="display: none;"></div>

      <!-- Outgoing Messages Log -->
      <div style="margin-top: 32px;">
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">Recent Transmission Audit Log</h3>
        <div id="share-history-table">
          <p style="color: var(--text-muted); font-size: 13px;">Loading dispatch history...</p>
        </div>
      </div>
    </div>

    <!-- False Positive Appeal Modal -->
    <div id="appeal-modal" class="modal-overlay" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size: 16px; font-weight: 700; color: #fff;">Submit False-Positive Review Appeal</h3>
          <button id="btn-close-appeal" class="modal-close-btn">&times;</button>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
          If this message was blocked erroneously (e.g., an authorized security training exercise), explain why it should be permitted.
        </p>
        <form id="appeal-form">
          <input type="hidden" id="appeal-msg-id" />
          <div class="form-group">
            <label class="form-label" for="appeal-reason">Appeal Justification / Context:</label>
            <textarea id="appeal-reason" class="cyber-textarea" placeholder="Explain the benign context..." required></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" id="btn-cancel-appeal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Appeal</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const SAMPLES = {
    scam: 'URGENT: Your account has been suspended. Please send your 6-digit OTP code to reactivate your banking access immediately.',
    borderline: 'Urgent notice regarding your package delivery hold: http://tracking-hub.xyz/parcel',
    clean: 'Hey team, here is the updated deployment checklist for our production release on Friday.'
  };

  container.querySelectorAll('.btn-sample').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sim = btn.getAttribute('data-sim');
      if (SAMPLES[sim]) {
        document.getElementById('share-content').value = SAMPLES[sim];
      }
    });
  });

  const form = document.getElementById('share-form');
  const btn = document.getElementById('btn-submit-share');
  const statusEl = document.getElementById('containment-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await attemptSendMessage(false);
  });

  async function attemptSendMessage(confirmSend = false) {
    const recipient = document.getElementById('share-recipient').value.trim();
    const content = document.getElementById('share-content').value.trim();
    if (!recipient || !content) return;

    btn.disabled = true;
    btn.innerHTML = 'Verifying Server Safety Gate...';
    statusEl.style.display = 'none';

    try {
      const res = await api.sendSharedMessage(recipient, content, confirmSend);

      statusEl.style.display = 'block';
      statusEl.innerHTML = `
        <div class="result-box" style="border-left: 4px solid var(--accent-emerald);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">✅</span>
            <div>
              <h4 style="color: var(--accent-emerald); font-size: 15px;">Transmission Approved & Delivered</h4>
              <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                ${res.message} (Risk Score: ${res.riskScore}/100, Status: ${res.status})
              </p>
            </div>
          </div>
        </div>
      `;
      document.getElementById('share-content').value = '';
      loadShareHistory();
    } catch (err) {
      statusEl.style.display = 'block';
      const data = err.data || {};

      if (data.status === 'blocked') {
        // High confidence malicious threat blocked
        statusEl.innerHTML = `
          <div class="result-box" style="border-left: 4px solid var(--accent-crimson);">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="font-size: 28px;">🚫</span>
              <div style="flex: 1;">
                <h4 style="color: var(--accent-crimson); font-size: 16px;">Transmission Blocked by Scam Containment Gate</h4>
                <p style="font-size: 13.5px; margin-top: 6px; color: #fff;">
                  ${data.message}
                </p>

                <div style="margin: 14px 0; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px;">
                  <span style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 6px;">FLAGGED SIGNALS (RISK SCORE: ${data.riskScore}/100 - ${data.severity})</span>
                  <ul style="list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px;">
                    ${(data.evidence || []).map((e) => `<li style="color: var(--accent-crimson);">● ${e}</li>`).join('')}
                  </ul>
                </div>

                <div style="margin-bottom: 14px;">
                  <span style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">SAFE NEXT STEPS:</span>
                  <ul style="font-size: 13px; color: var(--text-secondary); padding-left: 18px;">
                    ${(data.remediationSteps || []).map((r) => `<li>${r}</li>`).join('')}
                  </ul>
                </div>

                <button type="button" id="btn-trigger-appeal" class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;" data-msgid="${data.messageId}">
                  ⚖️ Submit False Positive Appeal
                </button>
              </div>
            </div>
          </div>
        `;

        document.getElementById('btn-trigger-appeal')?.addEventListener('click', (e) => {
          const msgId = e.target.getAttribute('data-msgid');
          openAppealModal(msgId);
        });
      } else if (data.status === 'warning_required') {
        // Borderline threat requiring warning confirmation
        statusEl.innerHTML = `
          <div class="result-box" style="border-left: 4px solid var(--accent-amber);">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="font-size: 28px;">⚠️</span>
              <div style="flex: 1;">
                <h4 style="color: var(--accent-amber); font-size: 16px;">Borderline Risk Warning</h4>
                <p style="font-size: 13.5px; margin-top: 4px; color: #fff;">
                  ${data.message} (Risk: ${data.riskScore}/100 - ${data.severity})
                </p>

                <div style="margin: 12px 0;">
                  <ul style="list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px;">
                    ${(data.evidence || []).map((e) => `<li style="color: var(--accent-amber);">● ${e}</li>`).join('')}
                  </ul>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 14px;">
                  <button type="button" id="btn-confirm-send" class="btn btn-primary" style="background: var(--accent-amber); color: #000;">
                    I Understand Risks, Transmit Anyway
                  </button>
                  <button type="button" onclick="document.getElementById('containment-status').style.display='none'" class="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;

        document.getElementById('btn-confirm-send')?.addEventListener('click', () => {
          attemptSendMessage(true);
        });
      } else {
        statusEl.innerHTML = `
          <div class="result-box" style="border-left: 4px solid var(--accent-crimson);">
            <h4 style="color: var(--accent-crimson);">Transmission Error</h4>
            <p style="margin-top: 6px; font-size: 13.5px;">${err.message}</p>
          </div>
        `;
      }
      loadShareHistory();
    } finally {
      btn.disabled = false;
      btn.innerHTML = '📤 Send Message (Passes Server-Side Gate)';
    }
  }

  // Appeal Modal
  const appealModal = document.getElementById('appeal-modal');
  const closeAppealBtn = document.getElementById('btn-close-appeal');
  const cancelAppealBtn = document.getElementById('btn-cancel-appeal');
  const appealForm = document.getElementById('appeal-form');

  function openAppealModal(msgId) {
    document.getElementById('appeal-msg-id').value = msgId;
    document.getElementById('appeal-reason').value = '';
    appealModal.style.display = 'flex';
  }

  function closeAppealModal() {
    appealModal.style.display = 'none';
  }

  closeAppealBtn.addEventListener('click', closeAppealModal);
  cancelAppealBtn.addEventListener('click', closeAppealModal);

  appealForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgId = document.getElementById('appeal-msg-id').value;
    const reason = document.getElementById('appeal-reason').value.trim();
    if (!reason) return;

    try {
      const res = await api.submitAppeal(msgId, reason);
      alert(`Appeal Registered (ID: ${res.appealId}). ${res.message}`);
      closeAppealModal();
    } catch (err) {
      alert(`Appeal submission failed: ${err.message}`);
    }
  });

  // History loader
  async function loadShareHistory() {
    const tableDiv = document.getElementById('share-history-table');
    try {
      const data = await api.getShareHistory();
      const messages = data.messages || [];

      if (messages.length === 0) {
        tableDiv.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No outgoing messages sent yet.</p>';
        return;
      }

      tableDiv.innerHTML = `
        <div style="overflow-x: auto;">
          <table class="cyber-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Recipient</th>
                <th>Snippet</th>
                <th>Risk Score</th>
                <th>Enforcement Action</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${messages
                .map(
                  (m) => `
                <tr>
                  <td>
                    <span class="badge-severity ${m.status === 'blocked' ? 'severity-Critical' : m.status === 'warning_acknowledged' ? 'severity-Medium' : 'severity-Low'}">
                      ${m.status.toUpperCase()}
                    </span>
                  </td>
                  <td>${m.recipient_email}</td>
                  <td style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.content_snippet}</td>
                  <td>${m.risk_score}/100</td>
                  <td style="color: ${m.status === 'blocked' ? 'var(--accent-crimson)' : 'var(--text-secondary)'}; font-size: 12px;">
                    ${m.status === 'blocked' ? m.blocked_reason : 'Delivered'}
                  </td>
                  <td style="color: var(--text-muted); font-size: 12px;">${new Date(m.created_at).toLocaleTimeString()}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      tableDiv.innerHTML = `<p style="color: var(--accent-crimson); font-size: 13px;">Failed to load history: ${err.message}</p>`;
    }
  }

  loadShareHistory();
}
