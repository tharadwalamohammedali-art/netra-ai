// Indicators & patterns for message / SMS / email scam detection
const SCAM_PATTERNS = [
  {
    category: 'Credential & OTP Theft',
    weight: 50,
    regex: /(?:share|provide|send|enter|verify|confirm)\s+(?:your|the)\s+(?:[0-9]{1,2}\s*[- ]*\s*digit\s+)?(?:otp|one[- ]time\s+password|passcode|pin|cvv|security\s+code|login\s+credentials|secret\s+key)/i,
    evidence: 'Urgent request to disclose a one-time password (OTP), PIN, CVV, or security code. Legitimate institutions never ask for your OTP.'
  },
  {
    category: 'Urgency & Psychological Coercion',
    weight: 30,
    regex: /(?:account\s+(?:(?:is|will\s+be|has\s+been)\s+)?(?:blocked|suspended|terminated|frozen|closed|locked|restricted|compromised|deactivated)|action\s+required\s+within\s+\d+\s*(?:hours|minutes)|immediate(?:ly)?\s+action\s+required|urgent\s+notice|arrest\s+warrant|legal\s+action\s+pending)/i,
    evidence: 'Artificial urgency or coercive language intended to panic the victim into bypassing security verification.'
  },
  {
    category: 'Lottery & Sweepstakes Fraud',
    weight: 35,
    regex: /(?:congratulations|you\s+have\s+been\s+selected|won\s+(?:the\s+)?(?:lottery|cash\s+prize|jackpot|\$[\d,]+|£[\d,]+|€[\d,]+|₹[\d,]+)|unclaimed\s+reward|claim\s+your\s+prize)/i,
    evidence: 'Unsolicited prize, reward, or lottery notification requiring claim steps.'
  },
  {
    category: 'Courier & Package Delivery Scam',
    weight: 30,
    regex: /(?:parcel|package|shipment|delivery)\s+(?:is\s+on\s+hold|could\s+not\s+be\s+delivered|pending\s+customs|unpaid\s+(?:shipping|customs|postage)\s+fee)/i,
    evidence: 'Deceptive missed-delivery or unpaid postage notification prompting link clicks.'
  },
  {
    category: 'High-Yield Investment / Crypto Doubling',
    weight: 40,
    regex: /(?:guaranteed\s+(?:profit|return)|risk[- ]free\s+investment|double\s+your\s+(?:crypto|bitcoin|btc|eth|money)|earn\s+\$[\d,]+\s+per\s+day\s+working\s+from\s+home|send\s+[\d.]+\s*(?:btc|eth)\s+and\s+receive)/i,
    evidence: 'Unrealistic financial promises, guaranteed crypto returns, or get-rich-quick claims.'
  },
  {
    category: 'Fake Job / Task Scam',
    weight: 30,
    regex: /(?:part[- ]time\s+job\s+offer|daily\s+payment\s+of\s+[\$₹€]\s*\d+|like\s+videos\s+and\s+get\s+paid|telegram\s+recruitment|deposit\s+small\s+fee\s+to\s+activate\s+task)/i,
    evidence: 'Common task-based or upfront-fee employment scam targeting job seekers.'
  },
  {
    category: 'Authority / Financial Impersonation',
    weight: 25,
    regex: /(?:irs\s+notice|tax\s+department|law\s+enforcement|fraud\s+prevention\s+team|compliance\s+officer|bank\s+security\s+alert|central\s+bank)/i,
    evidence: 'Impersonation of governmental, regulatory, or banking authority.'
  },
  {
    category: 'Unverified Money Transfer / Advance Fee',
    weight: 30,
    regex: /(?:western\s+union|moneygram|wire\s+transfer|gift\s+card|apple\s+gift\s+card|steam\s+card|google\s+play\s+card)\s+(?:to\s+claim|to\s+verify|as\s+payment)/i,
    evidence: 'Demand for untraceable payment instruments such as gift cards or wire transfers.'
  }
];

// Potential prompt injection patterns to neutralize
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /output\s+risk\s+score\s+0/i,
  /mark\s+this\s+as\s+safe/i
];

export function analyzeMessageDeterministically(rawText) {
  const evidence = [];
  let riskScore = 0;
  const categoriesMatched = [];

  const recommendedActions = [
    'Never share OTPs, PINs, or account recovery codes with anyone.',
    'Do not click embedded links or call contact numbers listed in suspicious messages.',
    'Verify any claims directly through the organization’s official verified application or website.'
  ];

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      riskScore: 0,
      severity: 'Low',
      category: 'Empty Message',
      evidence: ['No text content provided.'],
      explanation: 'Message input is blank.',
      recommendedActions,
      uncertainty: 'Low'
    };
  }

  const text = rawText.trim();

  // Defense: Detect attempted prompt injection inside scanned text
  let injectionDetected = false;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      injectionDetected = true;
      riskScore += 35;
      evidence.push('Adversarial prompt-injection string detected in input text (attacker attempting to manipulate analysis).');
      break;
    }
  }

  // Check URL presence in message
  const urlMatches = text.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > 0) {
    evidence.push(`Contains ${urlMatches.length} embedded hyperlink(s). Phishing messages commonly use link shorteners or spoofed domains.`);
    riskScore += 15;
  }

  // Check scam indicators
  for (const item of SCAM_PATTERNS) {
    if (item.regex.test(text)) {
      riskScore += item.weight;
      evidence.push(item.evidence);
      categoriesMatched.push(item.category);
    }
  }

  // Cap score to 0 - 100
  riskScore = Math.min(100, Math.max(0, riskScore));

  let severity = 'Low';
  if (riskScore >= 70) severity = 'Critical';
  else if (riskScore >= 45) severity = 'High';
  else if (riskScore >= 20) severity = 'Medium';

  let category = 'Clean / Low Suspicion';
  if (categoriesMatched.length > 0) {
    category = categoriesMatched[0];
  } else if (injectionDetected) {
    category = 'Adversarial Prompt Injection';
  } else if (urlMatches.length > 0) {
    category = 'Unverified External Link';
  }

  if (evidence.length === 0) {
    evidence.push('No obvious high-risk social engineering or urgent credential request keywords detected.');
  }

  const explanation = severity === 'Low'
    ? 'No prominent scam indicators found in the text. However, highly targeted spear-phishing or friendly conversational fraud can unfold over multiple exchanges.'
    : `Identified ${evidence.length} fraud risk signal(s) matching known social engineering attack vectors.`;

  return {
    riskScore,
    severity,
    category,
    evidence,
    explanation,
    recommendedActions,
    uncertainty: riskScore > 15 && riskScore < 60 ? 'Medium' : 'Low'
  };
}
