# NETRA AI — REST API Documentation

All API requests accept and return JSON with standard HTTP status codes.

---

## Public Endpoints

### 1. `GET /api/health`
Returns system health, database status, and Gemma 3:1B inference connection status.
```json
{
  "status": "online",
  "app": "NETRA AI",
  "node_version": "v24.21.0",
  "sqlite": "online",
  "model_contract": "Gemma 3:1B",
  "local_gemma_runtime": "connected (llama.cpp port 8080)" // or "standby"
}
```

### 2. `POST /api/auth/signup`
Registers a new user account with hashed PBKDF2 credentials.
- **Request**: `{ "email": "user@example.com", "password": "SuperPassword123" }`
- **Response (201)**: `{ "token": "<session_token>", "user": { ... } }`

### 3. `POST /api/auth/login`
Authenticates user and returns session token.
- **Request**: `{ "email": "user@example.com", "password": "SuperPassword123" }`
- **Response (200)**: `{ "token": "<session_token>", "user": { ... } }`

---

## Protected Endpoints (Requires `Authorization: Bearer <token>`)

### 4. `POST /api/scans/url`
Analyzes a web URL with SSRF checks, lookalike character heuristics, and Gemma 3:1B.
- **Request**: `{ "url": "https://example.com" }`
- **Response (200)**:
```json
{
  "scanId": "UUID",
  "scanType": "url",
  "riskScore": 75,
  "severity": "Critical",
  "category": "Brand Phishing",
  "evidence": ["Homoglyph lookalike character detected..."],
  "explanation": "...",
  "recommendedActions": ["..."],
  "uncertainty": "Low",
  "engineUsed": "Gemma 3:1B + Deterministic Rules",
  "engineStatus": "gemma_3_1b_simulated (local llama.cpp weights not loaded)"
}
```

### 5. `POST /api/scans/message`
Analyzes SMS, email, or chat text for social engineering, urgency, and OTP theft.
- **Request**: `{ "message": "Urgent: share your 6-digit OTP code..." }`
- **Response (200)**: Same structured contract as above.

### 6. `POST /api/scans/qr`
Decodes and inspects payment/UPI parameters, cryptocurrency addresses, and embedded links.
- **Request**: `{ "payload": "upi://pay?pa=store@upi&am=100" }`
- **Response (200)**: Structured contract + decoded `details.paymentParams`.

### 7. `GET /api/dashboard/metrics`
Returns real SQL-aggregated telemetry: total scans, severity distribution, top categories, and containment blocks.

### 8. `POST /api/share/send` (Feature 15 Safety Gate)
Server-side enforced gate for NETRA AI's internal sharing platform.
- **Request**: `{ "recipientEmail": "user@test.com", "content": "...", "confirmSend": false }`
- **Response (200)**: Message delivered.
- **Response (422)**: Borderline risk warning. Requires `confirmSend: true`.
- **Response (403)**: Blocked high-confidence malicious payload.

### 9. `POST /api/share/appeal`
Submits a false-positive review appeal for a blocked transmission.
- **Request**: `{ "messageId": "UUID", "reason": "Authorized red-team drill..." }`

### 10. `GET /api/scans`
Lists paginated scan history. Supports query parameters `?type=url&severity=High&limit=20`.

### 11. `GET /api/scans/export?format=csv` (or `json`)
Exports compliance reports in CSV or JSON format.

### 12. `GET /api/privacy/settings` & `PUT /api/privacy/settings`
Manages data retention policy (0, 7, 30, 90, 365 days) and local processing mode.

### 13. `POST /api/privacy/email-monitoring`
Enables or revokes authorized read-only email threat monitoring.

### 14. `GET /api/audit/logs`
Returns immutable audit log events.

### 15. `DELETE /api/auth/account`
Irreversibly deletes account and all associated telemetry.
