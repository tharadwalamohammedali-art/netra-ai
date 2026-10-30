import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { getDatabase } from './db/database.js';
import {
  applySecurityHeaders,
  checkRateLimit,
  authenticateRequest
} from './auth/middleware.js';
import {
  handleSignup,
  handleLogin,
  handleLogout,
  handleDeleteAccount
} from './controllers/authController.js';
import {
  handleScanUrl,
  handleScanMessage,
  handleScanQr,
  handleGetScans,
  handleGetScanDetails,
  handleDeleteScan,
  handleExportScans
} from './controllers/scanController.js';
import { handleGetDashboardMetrics } from './controllers/dashboardController.js';
import {
  handleSendMessage,
  handleSubmitAppeal,
  handleGetShareHistory
} from './controllers/shareController.js';
import {
  handleGetPrivacySettings,
  handleUpdatePrivacySettings,
  handleToggleEmailMonitoring
} from './controllers/privacyController.js';
import { handleGetAuditLogs } from './controllers/auditController.js';
import { checkGemmaRuntimeHealth } from './engines/gemmaAdapter.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req, maxSize = CONFIG.MAX_INPUT_TEXT_LENGTH * 2) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > maxSize) {
        reject(new Error('Payload too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error(`Invalid JSON: ${e.message}`));
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

export function createServer(customDb = null) {
  const db = customDb || getDatabase();

  const server = http.createServer(async (req, res) => {
    applySecurityHeaders(res);

    // Rate Limiting
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', rateCheck.retryAfterSeconds);
      return sendJson(res, 429, {
        error: 'Too many requests. Please slow down and try again shortly.',
        retryAfter: rateCheck.retryAfterSeconds
      });
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();
    const clientIp = req.socket.remoteAddress || '127.0.0.1';

    // CORS preflight handling (if needed)
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }

    // Static files router
    if (!pathname.startsWith('/api/')) {
      let targetPath = path.join(CONFIG.STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
      
      // Defend against path traversal
      if (!targetPath.startsWith(CONFIG.STATIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
      }

      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
        targetPath = path.join(targetPath, 'index.html');
      }

      if (fs.existsSync(targetPath)) {
        return serveStaticFile(req, res, targetPath);
      }

      // Single Page Application fallback to index.html
      const spaIndex = path.join(CONFIG.STATIC_DIR, 'index.html');
      if (fs.existsSync(spaIndex)) {
        return serveStaticFile(req, res, spaIndex);
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Frontend Not Found');
    }

    // API Routes
    try {
      // 1. Public Health & System Info
      if (pathname === '/api/health' && method === 'GET') {
        const gemmaLive = await checkGemmaRuntimeHealth();
        return sendJson(res, 200, {
          status: 'online',
          app: 'NETRA AI',
          node_version: process.version,
          sqlite: 'online',
          model_contract: 'Gemma 3:1B',
          local_gemma_runtime: gemmaLive ? 'connected (llama.cpp port 8080)' : 'standby (model contract adapter active)'
        });
      }

      if (pathname === '/api/info' && method === 'GET') {
        return sendJson(res, 200, {
          app: 'NETRA AI',
          model: 'Gemma 3:1B',
          runtime_instructions: 'Run llama-server -m gemma-3-1b-it.gguf --port 8080 for live GGUF inference.',
          rules_engine: 'Deterministic, explainable security heuristics',
          disclosure: CONFIG.DISCLOSURE_TEXT
        });
      }

      // 2. Authentication: Signup & Login
      if (pathname === '/api/auth/signup' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = handleSignup({ db, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = handleLogin({ db, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      // --- Authenticated Boundary ---
      const authUser = authenticateRequest(req, db);
      if (!authUser) {
        return sendJson(res, 401, { error: 'Authentication required. Please log in.' });
      }

      // Profile & Logout
      if (pathname === '/api/auth/me' && method === 'GET') {
        return sendJson(res, 200, { user: authUser });
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        const result = handleLogout({ db, token: authUser.token, userId: authUser.userId, clientIp });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/auth/account' && method === 'DELETE') {
        const result = handleDeleteAccount({ db, userId: authUser.userId, clientIp });
        return sendJson(res, result.status, result.data);
      }

      // 3. Scanners
      if (pathname === '/api/scans/url' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = await handleScanUrl({ db, userId: authUser.userId, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/scans/message' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = await handleScanMessage({ db, userId: authUser.userId, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/scans/qr' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = await handleScanQr({ db, userId: authUser.userId, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      // 4. Scan History & Export
      if (pathname === '/api/scans' && method === 'GET') {
        const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
        const result = handleGetScans({ db, userId: authUser.userId, queryParams });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/scans/export' && method === 'GET') {
        const format = parsedUrl.searchParams.get('format') || 'json';
        const result = handleExportScans({ db, userId: authUser.userId, format });
        res.writeHead(result.status, {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="netra_scans_${Date.now()}.${format}"`
        });
        return res.end(typeof result.data === 'string' ? result.data : JSON.stringify(result.data));
      }

      if (pathname.startsWith('/api/scans/') && method === 'GET') {
        const scanId = pathname.substring(11);
        const result = handleGetScanDetails({ db, userId: authUser.userId, scanId });
        return sendJson(res, result.status, result.data);
      }

      if (pathname.startsWith('/api/scans/') && method === 'DELETE') {
        const scanId = pathname.substring(11);
        const result = handleDeleteScan({ db, userId: authUser.userId, scanId });
        return sendJson(res, result.status, result.data);
      }

      // 5. Dashboard Metrics
      if (pathname === '/api/dashboard/metrics' && method === 'GET') {
        const result = handleGetDashboardMetrics({ db, userId: authUser.userId });
        return sendJson(res, result.status, result.data);
      }

      // 6. Scam Containment & NETRA AI Sharing Gate
      if (pathname === '/api/share/send' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = await handleSendMessage({ db, user: authUser, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/share/appeal' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = handleSubmitAppeal({ db, user: authUser, body });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/share/history' && method === 'GET') {
        const result = handleGetShareHistory({ db, user: authUser });
        return sendJson(res, result.status, result.data);
      }

      // 7. Privacy & Consent Center
      if (pathname === '/api/privacy/settings' && method === 'GET') {
        const result = handleGetPrivacySettings({ db, userId: authUser.userId });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/privacy/settings' && method === 'PUT') {
        const body = await parseJsonBody(req);
        const result = handleUpdatePrivacySettings({ db, userId: authUser.userId, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/privacy/email-monitoring' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = handleToggleEmailMonitoring({ db, userId: authUser.userId, body, clientIp });
        return sendJson(res, result.status, result.data);
      }

      // 8. Audit Logs
      if (pathname === '/api/audit/logs' && method === 'GET') {
        const result = handleGetAuditLogs({ db, user: authUser });
        return sendJson(res, result.status, result.data);
      }

      // Unmatched API route
      return sendJson(res, 404, { error: 'API endpoint not found.' });

    } catch (err) {
      console.error('Unhandled request error:', err);
      return sendJson(res, 500, { error: 'Internal Server Error.' });
    }
  });

  return server;
}

// Start server if directly executed
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const server = createServer();
  server.listen(CONFIG.PORT, CONFIG.HOST, () => {
    console.log(`=======================================================`);
    console.log(`🛡️  NETRA AI Server running at http://${CONFIG.HOST}:${CONFIG.PORT}`);
    console.log(`🤖  AI Model: Gemma 3:1B (Contract & Local Runtime Adapter)`);
    console.log(`🔒  Security Rules: Deterministic Phishing & Scam Engine`);
    console.log(`📦  Database: SQLite (WAL Mode)`);
    console.log(`=======================================================`);
  });
}
