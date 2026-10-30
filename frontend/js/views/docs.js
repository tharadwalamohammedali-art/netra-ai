export function renderDocs(container) {
  container.innerHTML = `
    <div class="cyber-card">
      <div class="card-header-flex">
        <div>
          <h2 class="card-title">📖 Architecture & Gemma 3:1B Setup Guide</h2>
          <p class="card-desc">Feature 14: Technical specifications, model contract schemas, local llama.cpp deployment path, and security threat model.</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 24px; font-size: 13.5px; line-height: 1.6;">
        <!-- Core Model Constraint -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
          <h3 style="color: var(--accent-cyan); font-size: 15px; margin-bottom: 8px;">1. Strict AI Model Mandate: Gemma 3:1B</h3>
          <p style="margin-bottom: 10px;">
            In accordance with project constraints, <strong>Gemma 3:1B is the ONLY AI model</strong> utilized by NETRA AI. No cloud APIs, paid AI services, or substitute models are permitted. Ollama is explicitly prohibited as a runtime dependency.
          </p>
          <div style="background: var(--bg-card); padding: 14px; border-radius: 6px; border-left: 3px solid var(--accent-cyan); font-family: var(--font-mono); font-size: 12.5px;">
            # Run Gemma 3:1B locally via llama.cpp server:<br>
            llama-server.exe -m ./models/gemma-3-1b-it.Q4_K_M.gguf --port 8080 --ctx-size 4096
          </div>
          <p style="margin-top: 10px; font-size: 12.5px; color: var(--text-muted);">
            When the local inference server on port 8080 is offline, NETRA AI operates in transparent simulated contract adapter mode. It never manufactures fake live inference or creates deceptive guarantees.
          </p>
        </div>

        <!-- Deterministic Rules Engine -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
          <h3 style="color: var(--accent-emerald); font-size: 15px; margin-bottom: 8px;">2. Deterministic & Explainable Rule Fusion</h3>
          <p style="margin-bottom: 10px;">
            Rules are not additional AI models. They provide explainable, verifiable cybersecurity checks alongside language reasoning:
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
            <li><strong>SSRF Defense:</strong> RFC1918 private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopbacks (127.0.0.1, localhost), and cloud metadata endpoints (169.254.169.254) are rejected immediately.</li>
            <li><strong>Homoglyphs:</strong> IDN Punycode decoding and Cyrillic/Greek character substitution mapping (e.g. Cyrillic 'а' vs Latin 'a').</li>
            <li><strong>Credential Theft:</strong> Heuristic extraction of high-risk OTP, PIN, and password solicitation patterns.</li>
            <li><strong>UPI QR Protocol:</strong> Parameter extraction of <code style="color:var(--accent-cyan);">upi://pay?pa=...&am=...</code> with verification against "Scan to receive" deceit.</li>
          </ul>
        </div>

        <!-- Feature 15 Containment Gate -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
          <h3 style="color: var(--accent-crimson); font-size: 15px; margin-bottom: 8px;">3. Feature 15: Scam Containment & Boundary Policy</h3>
          <p style="margin-bottom: 10px;">
            When users share content through NETRA AI's internal communication channel, the backend executes an atomic scan at dispatch time. High-confidence scams (Risk Score ≥ 70) are blocked with remediation steps and a false-positive appeal path.
          </p>
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 12px; border-radius: 6px; font-size: 12.5px;">
            <strong>Boundary Transparency:</strong> NETRA AI regulates its own platform sharing. It does not monitor, intercept, or tamper with messages in WhatsApp, Signal, or external cellular SMS without authorized carrier privileges.
          </div>
        </div>

        <!-- Disclaimers & Ethics -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
          <h3 style="color: var(--accent-amber); font-size: 15px; margin-bottom: 8px;">4. Responsible Security & Disclaimer</h3>
          <p style="color: var(--text-secondary);">
            No cybersecurity platform can guarantee 100% fraud immunity. Lightweight language models like Gemma 3:1B and deterministic heuristics are advisory tools designed to empower human judgment. Always verify financial transactions through official banking channels.
          </p>
        </div>
      </div>
    </div>
  `;
}
