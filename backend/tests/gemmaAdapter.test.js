import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGemmaOutput,
  buildGemma3Prompt,
  queryGemma3
} from '../src/engines/gemmaAdapter.js';

test('Gemma 3:1B: Schema validation enforces contract fields', () => {
  const validOutput = {
    risk_score: 85,
    severity: 'High',
    suspected_category: 'Credential Phishing',
    evidence: ['Suspicious domain lookalike detected.'],
    explanation: 'The message attempts to solicit banking credentials.',
    recommended_actions: ['Do not enter credentials.'],
    uncertainty: 'Low'
  };
  assert.equal(validateGemmaOutput(validOutput), true);

  // Missing evidence
  const invalidOutput = { ...validOutput, evidence: [] };
  assert.equal(validateGemmaOutput(invalidOutput), false);

  // Out of range risk score
  const outOfRange = { ...validOutput, risk_score: 150 };
  assert.equal(validateGemmaOutput(outOfRange), false);

  // Invalid severity enum
  const badSeverity = { ...validOutput, severity: 'Extreme' };
  assert.equal(validateGemmaOutput(badSeverity), false);
});

test('Gemma 3:1B: Prompt builder wraps untrusted input into Gemma 3 format', () => {
  const prompt = buildGemma3Prompt('message', 'Click here for prize', { category: 'Lottery', severity: 'Medium' });
  assert.ok(prompt.includes('<start_of_turn>user'));
  assert.ok(prompt.includes('<end_of_turn>'));
  assert.ok(prompt.includes('<start_of_turn>model'));
  assert.ok(prompt.includes('Gemma 3:1B'));
});

test('Gemma 3:1B: Adapter transparently falls back with contract adherence and honest status', async () => {
  const mockDeterministic = {
    riskScore: 75,
    severity: 'Critical',
    category: 'Credential & OTP Theft',
    evidence: ['Urgent request for OTP.'],
    explanation: 'Detected credential theft pattern.',
    recommendedActions: ['Never share OTP.'],
    uncertainty: 'Low'
  };

  const result = await queryGemma3('message', 'Please share OTP', mockDeterministic);

  assert.equal(result.model, 'Gemma 3:1B');
  assert.ok(result.engine_status.includes('gemma_3_1b_simulated'));
  assert.equal(result.risk_score, 75);
  assert.equal(result.severity, 'Critical');
  assert.ok(Array.isArray(result.evidence));
  assert.ok(Array.isArray(result.recommended_actions));
  assert.ok(result.explanation.length > 0);
});
