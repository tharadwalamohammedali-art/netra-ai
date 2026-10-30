import { executeScan, getUserScans, getScanById, deleteScan } from '../services/scanService.js';
import { CONFIG } from '../config.js';

export async function handleScanUrl({ db, userId, body, clientIp }) {
  const { url } = body || {};

  if (!url || typeof url !== 'string' || !url.trim()) {
    return { status: 400, data: { error: 'Please enter a URL to inspect.' } };
  }

  if (url.length > 2048) {
    return { status: 400, data: { error: 'URL exceeds maximum length of 2048 characters.' } };
  }

  try {
    const result = await executeScan({
      db,
      userId,
      scanType: 'url',
      inputContent: url.trim(),
      clientIp
    });

    return { status: 200, data: result };
  } catch (err) {
    return { status: 500, data: { error: `URL scan failed: ${err.message}` } };
  }
}

export async function handleScanMessage({ db, userId, body, clientIp }) {
  const { message } = body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return { status: 400, data: { error: 'Please paste message text to inspect.' } };
  }

  if (message.length > CONFIG.MAX_INPUT_TEXT_LENGTH) {
    return {
      status: 400,
      data: { error: `Message exceeds maximum allowed size (${CONFIG.MAX_INPUT_TEXT_LENGTH} chars).` }
    };
  }

  try {
    const result = await executeScan({
      db,
      userId,
      scanType: 'message',
      inputContent: message.trim(),
      clientIp
    });

    return { status: 200, data: result };
  } catch (err) {
    return { status: 500, data: { error: `Message scan failed: ${err.message}` } };
  }
}

export async function handleScanQr({ db, userId, body, clientIp }) {
  const { payload } = body || {};

  if (!payload || typeof payload !== 'string' || !payload.trim()) {
    return { status: 400, data: { error: 'No decoded QR payload or image content provided.' } };
  }

  if (payload.length > 50000) {
    return { status: 400, data: { error: 'QR payload exceeds size limit.' } };
  }

  try {
    const result = await executeScan({
      db,
      userId,
      scanType: 'qr',
      inputContent: payload.trim(),
      clientIp
    });

    return { status: 200, data: result };
  } catch (err) {
    return { status: 500, data: { error: `QR scan failed: ${err.message}` } };
  }
}

export function handleGetScans({ db, userId, queryParams }) {
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const offset = Math.max(0, parseInt(queryParams.offset || '0', 10));
  const scanType = queryParams.type || null;
  const severity = queryParams.severity || null;

  const scans = getUserScans({ db, userId, limit, offset, scanType, severity });
  return { status: 200, data: { scans, limit, offset } };
}

export function handleGetScanDetails({ db, userId, scanId }) {
  const scan = getScanById({ db, userId, scanId });
  if (!scan) {
    return { status: 404, data: { error: 'Scan record not found.' } };
  }
  return { status: 200, data: { scan } };
}

export function handleDeleteScan({ db, userId, scanId }) {
  const deleted = deleteScan({ db, userId, scanId });
  if (!deleted) {
    return { status: 404, data: { error: 'Scan record not found or already deleted.' } };
  }
  return { status: 200, data: { message: 'Scan record deleted.' } };
}

export function handleExportScans({ db, userId, format = 'json' }) {
  const scans = getUserScans({ db, userId, limit: 1000, offset: 0 });

  if (format === 'csv') {
    const headers = ['id', 'scan_type', 'target_preview', 'risk_score', 'severity', 'category', 'created_at'];
    const rows = scans.map((s) => [
      s.id,
      s.scan_type,
      `"${(s.target_preview || '').replace(/"/g, '""')}"`,
      s.risk_score,
      s.severity,
      `"${(s.category || '').replace(/"/g, '""')}"`,
      s.created_at
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return {
      status: 200,
      contentType: 'text/csv',
      data: csvContent
    };
  }

  return {
    status: 200,
    contentType: 'application/json',
    data: { exportedAt: new Date().toISOString(), scans }
  };
}
