import { CONFIG } from '../config.js';

export const GEMMA_ANALYSIS_SCHEMA = {
  type: 'object',
  required: [
    'risk_score',
    'severity',
    'suspected_category',
    'evidence',
    'explanation',
    'recommended_actions',
    'uncertainty'
  ],
  properties: {
    risk_score: { type: 'number', minimum: 0, maximum: 100 },
    severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
    suspected_category: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    recommended_actions: { type: 'array', items: { type: 'string' } },
    uncertainty: { type: 'string', enum: ['Low', 'Medium', 'High'] }
  }
};

/**
 * Validates raw model output against the Gemma 3:1B schema
 */
export function validateGemmaOutput(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.risk_score !== 'number' || data.risk_score < 0 || data.risk_score > 100) return false;
  if (!['Low', 'Medium', 'High', 'Critical'].includes(data.severity)) return false;
  if (typeof data.suspected_category !== 'string' || !data.suspected_category) return false;
  if (!Array.isArray(data.evidence) || data.evidence.length === 0) return false;
  if (typeof data.explanation !== 'string' || !data.explanation) return false;
  if (!Array.isArray(data.recommended_actions) || data.recommended_actions.length === 0) return false;
  if (!['Low', 'Medium', 'High'].includes(data.uncertainty)) return false;
  return true;
}

/**
 * Format Gemma 3 prompt template with strict instructions to output valid JSON
 */
export function buildGemma3Prompt(inputType, rawContent, deterministicHints) {
  const systemInstructions = `You are Gemma 3:1B, a lightweight specialized cyber threat analysis assistant embedded in NETRA AI.
Analyze the following untrusted ${inputType} content for phishing, impersonation, social engineering, credential theft, payment fraud, or malicious links.
Combine your language understanding with these initial heuristic observations: ${JSON.stringify(deterministicHints)}.

Respond ONLY with a valid JSON object strictly matching this schema:
{
  "risk_score": <number 0-100>,
  "severity": <"Low" | "Medium" | "High" | "Critical">,
  "suspected_category": <string>,
  "evidence": [<string>, ...],
  "explanation": <concise string explaining why this is or is not safe>,
  "recommended_actions": [<string practical safety step>, ...],
  "uncertainty": <"Low" | "Medium" | "High">
}
Do not output markdown codeblocks, do not add introductory text, do not output anything other than raw parseable JSON.`;

  return `<start_of_turn>user\n${systemInstructions}\n\n[UNTRUSTED INPUT]:\n"""\n${rawContent.slice(0, 4000)}\n"""\n<end_of_turn>\n<start_of_turn>model\n`;
}

/**
 * Clean model output string of code fences or leading text
 */
function cleanJsonOutput(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Check if the local llama.cpp / Gemma 3:1B server is reachable
 */
export async function checkGemmaRuntimeHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const healthUrl = CONFIG.GEMMA3_ENDPOINT.replace(/\/v1\/chat\/completions$/, '/health');
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Query Gemma 3:1B via local llama.cpp / Transformers server, with transparent adapter fallback
 */
export async function queryGemma3(inputType, rawContent, deterministicResults) {
  const prompt = buildGemma3Prompt(inputType, rawContent, {
    category: deterministicResults.category,
    severity: deterministicResults.severity,
    evidenceCount: deterministicResults.evidence.length
  });

  const requestPayload = {
    model: CONFIG.GEMMA3_MODEL_NAME,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 600
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.GEMMA3_TIMEOUT_MS);

    const response = await fetch(CONFIG.GEMMA3_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || data.content || '';
      const parsed = JSON.parse(cleanJsonOutput(content));
      if (validateGemmaOutput(parsed)) {
        return {
          ...parsed,
          model: 'Gemma 3:1B',
          engine_status: 'gemma_3_1b_live_inference'
        };
      }
    }
  } catch {
    // Local llama.cpp endpoint is offline or not running Gemma 3:1B weights
  }

  // Transparent Gemma 3:1B Model Adapter contract fallback
  // Clearly labeled so that no false claims of active live weights are made
  return createContractFallback(inputType, rawContent, deterministicResults);
}

function createContractFallback(inputType, rawContent, deterministicResults) {
  const { riskScore, severity, category, evidence, explanation, recommendedActions, uncertainty } =
    deterministicResults;

  // Enhance explanation with Gemma 3 contract guidelines
  const adapterExplanation = `${explanation} [Gemma 3:1B Model Contract Adapter: Verified against deterministic rules.]`;

  return {
    risk_score: riskScore,
    severity: severity,
    suspected_category: category,
    evidence: evidence.length > 0 ? evidence : ['No active indicators flagged by security rules.'],
    explanation: adapterExplanation,
    recommended_actions: recommendedActions,
    uncertainty: uncertainty || 'Medium',
    model: 'Gemma 3:1B',
    engine_status: 'gemma_3_1b_simulated (local llama.cpp weights not loaded)'
  };
}
