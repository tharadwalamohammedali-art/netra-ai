import { isIP } from 'node:net';

// Disallowed private / SSRF / loopback ranges
const PRIVATE_IP_PATTERNS = [
  /^127\./,                         // Loopback
  /^10\./,                          // 10.0.0.0/8
  /^192\.168\./,                    // 192.168.0.0/16
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^169\.254\./,                    // Link-local / Cloud metadata (169.254.169.254)
  /^0\./,                           // 0.0.0.0/8
  /^::1$/,                          // IPv6 loopback
  /^fe80:/i,                        // IPv6 link-local
  /^fc00:/i                         // IPv6 unique local
];

// Cyrillic / Greek homoglyphs commonly used in IDN spoofing
const HOMOGLYPH_MAP = {
  '\u0430': 'a', // Cyrillic small letter a
  '\u0441': 'c', // Cyrillic small letter es
  '\u0435': 'e', // Cyrillic small letter ie
  '\u043E': 'o', // Cyrillic small letter o
  '\u0440': 'p', // Cyrillic small letter er
  '\u0455': 's', // Cyrillic small letter dze
  '\u0445': 'x', // Cyrillic small letter ha
  '\u0443': 'y', // Cyrillic small letter u
  '\u0456': 'i', // Cyrillic small letter byelorussian-ukrainian i
  '\u0458': 'j', // Cyrillic small letter je
  '\u03BF': 'o', // Greek small letter omicron
  '\u03C1': 'p', // Greek small letter rho
  '\u03BD': 'v'  // Greek small letter nu
};

// Target brands frequently targeted in phishing attacks
const TARGETED_BRANDS = [
  'paypal', 'apple', 'google', 'microsoft', 'netflix', 'amazon',
  'chase', 'wellsfargo', 'bankofamerica', 'binance', 'coinbase',
  'facebook', 'instagram', 'whatsapp', 'fedex', 'dhl', 'usps',
  'barclays', 'hsbc', 'steam', 'roblox', 'telegram'
];

// High-risk TLDs frequently abused in rapid phishing campaigns
const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'buzz',
  'country', 'click', 'work', 'icu', 'cam', 'quest', 'rest', 'sbs'
]);

// Suspicious auth & urgent path/subdomain tokens
const SUSPICIOUS_TOKENS = [
  'login', 'signin', 'verify', 'verification', 'update', 'security',
  'account', 'banking', 'confirm', 'wallet', 'claim', 'secure',
  'support', 'recover', 'billing', 'invoice', 'authenticate'
];

export function checkSSRFSafety(hostname) {
  const cleanHost = hostname.trim().toLowerCase();

  // Check localhost & metadata domains
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'instance-data'
  ) {
    return { safe: false, reason: 'Localhost and cloud internal metadata hostnames are blocked for security.' };
  }

  // Check IP addresses
  const ipVersion = isIP(cleanHost);
  if (ipVersion !== 0) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(cleanHost)) {
        return {
          safe: false,
          reason: `Private or loopback IP address (${cleanHost}) blocked by SSRF defense.`
        };
      }
    }
  }

  return { safe: true };
}

export function analyzeUrlDeterministically(rawUrl) {
  const evidence = [];
  let riskScore = 0;
  const recommendedActions = [
    'Do not enter credentials, passwords, or personal payment data.',
    'Verify the sender through an official phone number or official app.'
  ];

  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      riskScore: 0,
      severity: 'Low',
      category: 'Invalid URL',
      evidence: ['No URL provided for analysis.'],
      explanation: 'Empty or invalid URL input.',
      recommendedActions,
      uncertainty: 'Low',
      parsedUrl: null
    };
  }

  const trimmed = rawUrl.trim();
  let parsed;

  try {
    // If the input already contains a URI scheme (like javascript:, file:, data:, ftp:, http:, https:)
    // parse it directly. Only prepend https:// if it has no scheme at all (e.g. "example.com/path").
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed);
    const urlToParse = hasScheme ? trimmed : `https://${trimmed}`;
    parsed = new URL(urlToParse);
  } catch (err) {
    return {
      riskScore: 65,
      severity: 'Medium',
      category: 'Malformed URL',
      evidence: [`Failed to parse standard URL structure: ${err.message}`],
      explanation: 'The provided string does not conform to valid URI RFC specifications.',
      recommendedActions: ['Treat malformed URLs with extreme caution as attackers often craft obfuscated strings.'],
      uncertainty: 'Medium',
      parsedUrl: null
    };
  }

  // Scheme verification
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      riskScore: 90,
      severity: 'Critical',
      category: 'Dangerous Protocol Scheme',
      evidence: [`Prohibited protocol scheme detected: ${parsed.protocol}`],
      explanation: 'Non-web schemes (such as javascript:, data:, file:) are frequently used for direct client-side exploits.',
      recommendedActions: ['Never open links using non-standard web protocols.'],
      uncertainty: 'Low',
      parsedUrl: null
    };
  }

  // SSRF Protection check
  const ssrfCheck = checkSSRFSafety(parsed.hostname);
  if (!ssrfCheck.safe) {
    evidence.push(ssrfCheck.reason);
    riskScore += 80;
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();
  const hostParts = hostname.split('.');
  const tld = hostParts.length > 1 ? hostParts[hostParts.length - 1] : '';

  // 1. IP Address as host
  if (isIP(hostname) !== 0) {
    riskScore += 45;
    evidence.push(`Bare IP address used as hostname (${hostname}) instead of a verified registered domain.`);
  }

  // 2. Punycode & Homoglyph spoofing detection
  if (hostname.includes('xn--')) {
    riskScore += 40;
    evidence.push(`Internationalized Domain Name (Punycode: ${hostname}) detected, which can disguise visual lookalike characters.`);
  }

  for (const [char, replacement] of Object.entries(HOMOGLYPH_MAP)) {
    if (rawUrl.includes(char)) {
      riskScore += 50;
      evidence.push(`Homoglyph lookalike character detected ('${char}' mimicking Latin '${replacement}').`);
      break;
    }
  }

  // 3. Userinfo / Credentials trick (e.g. http://paypal.com@attacker.com)
  if (parsed.username || parsed.password) {
    riskScore += 70;
    evidence.push(`Misleading userinfo embedding detected (@ symbol used before host: "${parsed.username}@${hostname}").`);
  }

  // 4. Excessive subdomain depth
  if (hostParts.length >= 4) {
    riskScore += 25;
    evidence.push(`Unusual subdomain depth (${hostParts.length} levels) often used to conceal real domain owner.`);
  }

  // 5. High-risk TLD abused in spam
  if (SUSPICIOUS_TLDS.has(tld)) {
    riskScore += 20;
    evidence.push(`Domain uses top-level domain (.${tld}) with elevated prevalence in low-cost disposable phishing campaigns.`);
  }

  // 6. Brand Impersonation / Typosquatting checks
  let brandMatched = null;
  for (const brand of TARGETED_BRANDS) {
    // If brand appears in subdomains or path, but the root domain is NOT the official brand domain
    const isOfficial = hostname === `${brand}.com` || hostname.endsWith(`.${brand}.com`);
    if (!isOfficial) {
      if (hostname.includes(brand)) {
        brandMatched = brand;
        riskScore += 50;
        evidence.push(`High-profile brand name "${brand}" found inside suspicious domain "${hostname}".`);
        break;
      } else if (pathname.includes(brand) || search.includes(brand)) {
        riskScore += 25;
        evidence.push(`Brand name "${brand}" detected in URL path/query parameters.`);
      }
    }
  }

  // 7. Sensitive tokens in path/subdomain
  let tokenCount = 0;
  for (const token of SUSPICIOUS_TOKENS) {
    if (hostname.includes(token) || pathname.includes(token) || search.includes(token)) {
      tokenCount++;
    }
  }
  if (tokenCount >= 2) {
    riskScore += 25;
    evidence.push(`Multiple high-risk credential-harvesting tokens (${tokenCount} found) present in URL.`);
  } else if (tokenCount === 1) {
    riskScore += 10;
  }

  // 8. Insecure HTTP for authentication-related targets
  if (parsed.protocol === 'http:' && (tokenCount > 0 || brandMatched)) {
    riskScore += 20;
    evidence.push('Insecure HTTP protocol used on authentication/login-themed endpoint.');
  }

  // 9. Obfuscated encoding
  if (/%[0-9a-f]{2}/i.test(parsed.pathname) && (parsed.pathname.includes('%2f') || parsed.pathname.includes('%25'))) {
    riskScore += 25;
    evidence.push('Double-encoding or path traversal obfuscation sequences detected in URL path.');
  }

  // Normalize risk score to 0 - 100
  riskScore = Math.min(100, Math.max(0, riskScore));

  let severity = 'Low';
  if (riskScore >= 75) severity = 'Critical';
  else if (riskScore >= 50) severity = 'High';
  else if (riskScore >= 25) severity = 'Medium';

  let category = 'Clean / Low Suspicion';
  if (severity === 'Critical' || severity === 'High') {
    category = brandMatched ? `Brand Phishing (${brandMatched})` : 'Credential Harvesting / Suspicious Phishing';
  } else if (severity === 'Medium') {
    category = 'Suspicious Domain Heuristics';
  }

  if (evidence.length === 0) {
    evidence.push('No obvious homoglyphs, IP hostnames, or brand typosquatting detected in URL structure.');
  }

  const explanation = severity === 'Low'
    ? `The URL structure does not display common deceptive markers. Note: URL appearance alone cannot prove a site is legitimate; malicious pages can exist on compromised genuine domains.`
    : `Detected ${evidence.length} suspicious structural signal(s) suggesting potential deception, spoofing, or credential phishing.`;

  return {
    riskScore,
    severity,
    category,
    evidence,
    explanation,
    recommendedActions,
    uncertainty: riskScore > 20 && riskScore < 70 ? 'Medium' : 'Low',
    parsedUrl: {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      search: parsed.search
    }
  };
}
