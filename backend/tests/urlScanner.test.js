import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUrlDeterministically, checkSSRFSafety } from '../src/engines/urlScanner.js';

test('URL Engine: SSRF Defense blocks private and loopback networks', () => {
  assert.equal(checkSSRFSafety('localhost').safe, false);
  assert.equal(checkSSRFSafety('127.0.0.1').safe, false);
  assert.equal(checkSSRFSafety('10.0.0.5').safe, false);
  assert.equal(checkSSRFSafety('192.168.1.1').safe, false);
  assert.equal(checkSSRFSafety('169.254.169.254').safe, false);
  assert.equal(checkSSRFSafety('metadata.google.internal').safe, false);
  assert.equal(checkSSRFSafety('example.com').safe, true);
});

test('URL Engine: Dangerous protocol detection', () => {
  const jsRes = analyzeUrlDeterministically('javascript:alert(1)');
  assert.equal(jsRes.severity, 'Critical');
  assert.ok(jsRes.evidence[0].includes('Prohibited protocol'));

  const fileRes = analyzeUrlDeterministically('file:///etc/passwd');
  assert.equal(fileRes.severity, 'Critical');
});

test('URL Engine: Homoglyph / Cyrillic spoofing detection', () => {
  // Using Cyrillic 'а' (\u0430) instead of Latin 'a' in 'apple.com'
  const spoofedUrl = 'https://\u0430pple.com/login';
  const res = analyzeUrlDeterministically(spoofedUrl);

  assert.ok(res.riskScore >= 50);
  assert.ok(res.evidence.some((e) => e.includes('Homoglyph lookalike character')));
});

test('URL Engine: Brand impersonation & typosquatting signals', () => {
  const phishingUrl = 'http://paypal-security-verification.xyz/update';
  const res = analyzeUrlDeterministically(phishingUrl);

  assert.ok(res.riskScore >= 60);
  assert.ok(res.severity === 'High' || res.severity === 'Critical');
  assert.ok(res.evidence.some((e) => e.includes('paypal')));
  assert.ok(res.evidence.some((e) => e.includes('.xyz')));
});

test('URL Engine: Userinfo embedding credential trick', () => {
  const deceptiveUrl = 'https://google.com@evil-attacker-site.com/auth';
  const res = analyzeUrlDeterministically(deceptiveUrl);

  assert.ok(res.riskScore >= 70);
  assert.ok(res.evidence.some((e) => e.includes('userinfo embedding')));
});

test('URL Engine: Standard clean URL with honest disclaimer', () => {
  const cleanUrl = 'https://github.com/torvalds/linux';
  const res = analyzeUrlDeterministically(cleanUrl);

  assert.equal(res.severity, 'Low');
  assert.ok(res.explanation.includes('URL appearance alone cannot prove a site is legitimate'));
});
