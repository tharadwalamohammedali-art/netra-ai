import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeQrPayload } from '../src/engines/qrScanner.js';

test('QR Engine: Valid UPI Payment URI parsing', () => {
  const upiPayload = 'upi://pay?pa=store@hdfcbank&pn=Supermarket&am=250.00&cu=INR&tn=Groceries';
  const res = analyzeQrPayload(upiPayload);

  assert.equal(res.category, 'UPI Payment QR');
  assert.equal(res.qrDetails.type, 'upi_payment');
  assert.equal(res.qrDetails.paymentParams.pa, 'store@hdfcbank');
  assert.equal(res.qrDetails.paymentParams.am, '250.00');
  assert.equal(res.severity, 'Low');
});

test('QR Engine: Deceptive UPI "Scan to receive" trick', () => {
  const scamUpi = 'upi://pay?pa=refund_support@okhdfcbank&pn=Helpdesk&am=15000&cu=INR&tn=Scan+to+receive+lottery+refund';
  const res = analyzeQrPayload(scamUpi);

  assert.ok(res.riskScore >= 70);
  assert.equal(res.severity, 'Critical');
  assert.equal(res.category, 'Deceptive Payment QR');
  assert.ok(res.evidence.some((e) => e.includes('Scan to receive')));
});

test('QR Engine: URL Shortener in QR destination', () => {
  const shortenerQr = 'https://bit.ly/3xyzSecretReward';
  const res = analyzeQrPayload(shortenerQr);

  assert.ok(res.riskScore >= 25);
  assert.ok(res.evidence.some((e) => e.includes('URL shortener')));
});

test('QR Engine: Cryptocurrency wallet destination', () => {
  const btcPayload = 'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.5';
  const res = analyzeQrPayload(btcPayload);

  assert.equal(res.category, 'Cryptocurrency Address');
  assert.ok(res.riskScore >= 35);
});
