/**
 * NETRA AI — Client API Gateway
 */

class ApiClient {
  constructor() {
    this.baseUrl = '';
    this.token = localStorage.getItem('netra_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('netra_token', token);
    } else {
      localStorage.removeItem('netra_token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers
    };

    let response;
    try {
      response = await fetch(url, config);
    } catch (err) {
      throw new Error(`Network error: Could not reach NETRA AI server (${err.message}).`);
    }

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = (data && data.error) || (data && data.message) || `HTTP error ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // System
  getHealth() {
    return this.request('/api/health');
  }

  getInfo() {
    return this.request('/api/info');
  }

  // Auth
  signup(email, password) {
    return this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  getMe() {
    return this.request('/api/auth/me');
  }

  deleteAccount() {
    return this.request('/api/auth/account', { method: 'DELETE' });
  }

  // Scanners
  scanUrl(url) {
    return this.request('/api/scans/url', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  }

  scanMessage(message) {
    return this.request('/api/scans/message', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  scanQr(payload) {
    return this.request('/api/scans/qr', {
      method: 'POST',
      body: JSON.stringify({ payload })
    });
  }

  // Scan History
  getScans(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/scans${qs ? `?${qs}` : ''}`);
  }

  getScanDetails(scanId) {
    return this.request(`/api/scans/${scanId}`);
  }

  deleteScan(scanId) {
    return this.request(`/api/scans/${scanId}`, { method: 'DELETE' });
  }

  getExportUrl(format = 'json') {
    return `/api/scans/export?format=${format}`;
  }

  // Dashboard
  getDashboardMetrics() {
    return this.request('/api/dashboard/metrics');
  }

  // Containment & Sharing Gate (Feature 15)
  sendSharedMessage(recipientEmail, content, confirmSend = false) {
    return this.request('/api/share/send', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail, content, confirmSend })
    });
  }

  submitAppeal(messageId, reason) {
    return this.request('/api/share/appeal', {
      method: 'POST',
      body: JSON.stringify({ messageId, reason })
    });
  }

  getShareHistory() {
    return this.request('/api/share/history');
  }

  // Privacy & Consent
  getPrivacySettings() {
    return this.request('/api/privacy/settings');
  }

  updatePrivacySettings(historyRetentionDays, processingMode) {
    return this.request('/api/privacy/settings', {
      method: 'PUT',
      body: JSON.stringify({ historyRetentionDays, processingMode })
    });
  }

  toggleEmailMonitoring(enable, emailAddress = null) {
    return this.request('/api/privacy/email-monitoring', {
      method: 'POST',
      body: JSON.stringify({ enable, emailAddress })
    });
  }

  // Audit Logs
  getAuditLogs() {
    return this.request('/api/audit/logs');
  }
}

export const api = new ApiClient();
