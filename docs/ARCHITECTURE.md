# NETRA AI — System Architecture & Threat Model

NETRA AI is an AI-powered scam detection, phishing prevention, and digital fraud protection platform. It fuses **Gemma 3:1B local inference** with **deterministic, explainable cybersecurity rules**.

---

## 1. High-Level Architecture

```
                      ┌────────────────────────────────────────┐
                      │    Modern Responsive Frontend (SPA)    │
                      │ HTML5 / Vanilla ES Modules / Cyber CSS │
                      └───────────────────┬────────────────────┘
                                          │ REST API / JSON
                                          ▼
                      ┌────────────────────────────────────────┐
                      │        NETRA AI Core Server            │
                      │  Node 24 (Native SQLite / WebCrypto)   │
                      │  or Python 3 / FastAPI Backend         │
                      └───────┬────────────────────────┬───────┘
                              │                        │
         ┌────────────────────┴───────────┐            │
         ▼                                ▼            ▼
┌──────────────────┐            ┌──────────────────┐ ┌──────────────────┐
│  Deterministic   │            │ Gemma 3:1B Model │ │ SQLite 3 Store   │
│  Security Rules  │            │ Adapter Contract │ │ (WAL Mode)       │
│  - SSRF Defense  │            │ - Schema Parser  │ │ - Users & Auth   │
│  - Homoglyphs    │            │ - Llama.cpp / HF │ │ - Scans History  │
│  - OTP Harvesting│            │ - Health Monitor │ │ - Sharing Gate   │
│  - UPI QR Parser │            │ - Honest Fallback│ │ - Audit Logs     │
└──────────────────┘            └──────────────────┘ └──────────────────┘
```

---

## 2. Core Design Principles

1. **Strict AI Constraint**:
   - **Gemma 3:1B** is the ONLY AI model used in the platform.
   - No cloud AI APIs (OpenAI, Anthropic, Gemini Cloud, etc.) are permitted or used.
   - Ollama is explicitly forbidden as a runtime dependency.
   - Supported runtimes: **llama.cpp** (`llama-server`) with Gemma 3:1B GGUF weights, or Hugging Face **Transformers**.
   - If local weights are offline, NETRA AI operates in transparent simulated contract adapter mode without manufacturing fake inference results.

2. **Deterministic Rules Engine**:
   - Rules are not additional AI models. They provide explainable, verifiable cybersecurity signals.
   - Deterministic high-severity security rules always take precedence or raise risk to prevent small-model hallucinations from downplaying known threats.

3. **Privacy by Design**:
   - Zero telemetry, messages, or URLs are shared with third parties.
   - Configurable retention periods (0, 7, 30, 90, 365 days) with immediate zero-retention database wiping.
   - All background monitoring requires explicit, informed, revocable consent.

---

## 3. Threat Model & Defenses

| Threat Vector | NETRA AI Defense Mechanism |
|---|---|
| **Server-Side Request Forgery (SSRF)** | `checkSSRFSafety` validates IP and host. Blocks private IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), link-local/cloud metadata (169.254.169.254, metadata.google.internal), loopbacks (127.0.0.1, localhost, ::1), and 0.0.0.0. |
| **Punycode & Homoglyph Spoofing** | Inspects Unicode codepoints against Greek/Cyrillic lookalikes mimicking Latin characters (e.g. Cyrillic `а` \u0430 for `a`). |
| **Credential & OTP Theft** | Hard heuristics flag urgent solicitations for one-time passwords, PINs, CVVs, and verification codes. Enforces critical warning banners. |
| **UPI / Payment QR Scams** | Parses `upi://pay?pa=...` parameters. Flags "Scan to receive" deceit (scanning never receives funds, only debits). Never auto-opens destinations or initiates payments. |
| **Adversarial Prompt Injection** | Scanned user inputs are treated as untrusted data strings. Input sanitization neutralizes jailbreak attempts (`Ignore previous instructions...`). |
| **Brute Force & DoS** | In-memory leaky-bucket rate limiter per IP address with `429 Too Many Requests` and `Retry-After` headers. |
| **SQL Injection (SQLi)** | 100% of SQLite database queries use parameterized SQL prepared statements. |
| **Spam / Fraud Redistribution** | Feature 15 server-side safety gate intercepts internal message dispatch, blocking high-confidence scams at the API layer with false-positive appeal options. |
