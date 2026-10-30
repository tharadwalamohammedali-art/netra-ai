import { analyzeUrlDeterministically } from './urlScanner.js';

export function analyzeQrPayload(payload) {
  const evidence = [];
  let riskScore = 0;
  const recommendedActions = [
    'QR codes can only DEBIT money from your bank account; scanning a QR code will NEVER credit money to you.',
    'Always confirm the exact payee name displayed by your official banking app before authorizing any payment.',
    'Do not click or approve links decoded from unverified stickers pasted over public merchant codes.'
  ];

  if (!payload || typeof payload !== 'string' || !payload.trim()) {
    return {
      riskScore: 0,
      severity: 'Low',
      category: 'Empty QR Data',
      evidence: ['No data was decoded from the QR code.'],
      explanation: 'Decoded QR code was empty or unreadable.',
      recommendedActions,
      uncertainty: 'Low',
      qrDetails: null
    };
  }

  const rawData = payload.trim();
  let qrType = 'plain_text';
  const qrDetails = {
    raw: rawData,
    type: 'plain_text',
    paymentParams: null,
    embeddedUrl: null
  };

  // 1. UPI Payment URI Scheme (upi://pay?...)
  if (/^upi:\/\/pay\?/i.test(rawData)) {
    qrType = 'upi_payment';
    qrDetails.type = 'upi_payment';
    evidence.push('Decoded valid Unified Payments Interface (UPI) payment protocol URI.');

    try {
      const parsedUrl = new URL(rawData);
      const params = Object.fromEntries(parsedUrl.searchParams.entries());
      qrDetails.paymentParams = params;

      const pa = params.pa || ''; // Payee Address / VPA
      const pn = params.pn || ''; // Payee Name
      const am = params.am || ''; // Amount
      const cu = params.cu || 'INR';
      const tn = params.tn || ''; // Transaction Note

      if (pa) {
        evidence.push(`Recipient VPA / Address: ${pa}`);
        // Check suspicious VPA patterns
        if (/refund|cashback|prize|lottery|winner|kyc|support/i.test(pa)) {
          riskScore += 45;
          evidence.push(`Payee VPA contains high-risk deceptive terms ("${pa}") mimicking official support/cashback.`);
        }
      } else {
        riskScore += 30;
        evidence.push('UPI URI is missing the required payee address (pa) parameter.');
      }

      if (pn) {
        evidence.push(`Payee Display Name in QR: "${pn}". (Warning: This name is self-declared by the QR creator and not cryptographically verified).`);
      }

      if (am) {
        evidence.push(`Pre-filled Transaction Amount: ${am} ${cu}. Authorizing will immediately debit this sum.`);
        if (parseFloat(am) > 5000) {
          riskScore += 20;
          evidence.push(`High pre-set transaction amount (${am} ${cu}) detected.`);
        }
      }

      if (tn) {
        evidence.push(`Transaction Note: "${tn}"`);
        if (/scan\s+to\s+receive|receive\s+money|lottery|claim\s+refund/i.test(tn)) {
          riskScore += 50;
          evidence.push('Transaction note falsely claims scanning will "receive" or "refund" money. Scanners only PAY.');
        }
      }

    } catch (e) {
      riskScore += 30;
      evidence.push(`Malformed UPI URI parameters: ${e.message}`);
    }
  }
  // 2. Cryptocurrency payment URI (bitcoin:, ethereum:, etc.)
  else if (/^(bitcoin|ethereum|litecoin|doge|solana):/i.test(rawData)) {
    qrType = 'crypto_payment';
    qrDetails.type = 'crypto_payment';
    riskScore += 35;
    evidence.push(`Cryptocurrency wallet address QR code (${rawData.split(':')[0]}) detected. Cryptocurrency transactions are irreversible.`);
    recommendedActions.push('Ensure the destination wallet address matches through a trusted external channel.');
  }
  // 3. Web URL QR code
  else if (/^https?:\/\//i.test(rawData)) {
    qrType = 'web_url';
    qrDetails.type = 'web_url';
    qrDetails.embeddedUrl = rawData;
    evidence.push('QR code contains an external web hyperlink.');

    // Analyze embedded URL with the URL scanner engine
    const urlAnalysis = analyzeUrlDeterministically(rawData);
    riskScore += urlAnalysis.riskScore;
    for (const ev of urlAnalysis.evidence) {
      evidence.push(`[URL Heuristic] ${ev}`);
    }

    // Check for shorteners
    if (/bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|rb\.gy/i.test(rawData)) {
      riskScore += 25;
      evidence.push('URL shortener detected in QR code, hiding the real target destination from preview.');
    }
  }
  // 4. Other URI schemes
  else if (/^[a-zA-Z0-9_-]+:\/\//i.test(rawData)) {
    qrType = 'custom_protocol';
    qrDetails.type = 'custom_protocol';
    riskScore += 40;
    evidence.push(`Unrecognized or non-standard protocol URI scheme detected: ${rawData.split('://')[0]}`);
  }

  // Normalize risk score
  riskScore = Math.min(100, Math.max(0, riskScore));

  let severity = 'Low';
  if (riskScore >= 70) severity = 'Critical';
  else if (riskScore >= 45) severity = 'High';
  else if (riskScore >= 20) severity = 'Medium';

  let category = 'Standard QR Payload';
  if (qrType === 'upi_payment') {
    category = severity === 'Low' ? 'UPI Payment QR' : 'Deceptive Payment QR';
  } else if (qrType === 'crypto_payment') {
    category = 'Cryptocurrency Address';
  } else if (qrType === 'web_url') {
    category = severity === 'Low' ? 'Web Destination QR' : 'Phishing / Suspicious QR Link';
  }

  const explanation = severity === 'Low'
    ? `The QR code encodes standard ${qrType.replace('_', ' ')} data with no detected malicious redirection tokens. Always review recipient credentials before authorizing payment.`
    : `Identified ${evidence.length} risk factor(s) in decoded QR parameters. Never scan a QR code expecting to receive funds.`;

  return {
    riskScore,
    severity,
    category,
    evidence,
    explanation,
    recommendedActions,
    uncertainty: riskScore > 15 && riskScore < 60 ? 'Medium' : 'Low',
    qrDetails
  };
}
