/**
 * Fleet — privacy lint (Fleet P8).
 *
 * Pre-dispatch scan to flag prompts that LIKELY contain secrets
 * before they leave the local machine. The router's privacyTag
 * defaults to `'public'` — when the lint flags a prompt as risky,
 * the dispatcher should bump it to `'sensitive'` (vetoes cloud
 * peers) or block outright depending on user preference.
 *
 * The lint is a heuristic: it errs on the side of false positives.
 * The user always has the final say (Cowork modal "found secret —
 * keep, redact, or downgrade?").
 *
 * @module fleet/privacy-lint
 */

export type PrivacyMatchKind =
  | 'env-key'           // API keys (sk-…, AKIA…, AIza…, ghp_…, etc.)
  | 'private-path'      // /home/<user>, C:\Users\<u>, /Users/<u>
  | 'dotenv-block'      // multi-line block starting with KEY=VALUE
  | 'jwt'               // 3-segment dot-separated base64 token
  | 'aws-secret-key'    // 40-char base64 secret
  | 'private-key-pem';  // BEGIN PRIVATE KEY / OPENSSH / RSA blocks

export interface PrivacyMatch {
  kind: PrivacyMatchKind;
  /** Where in the prompt the match was found (chars). */
  start: number;
  end: number;
  /** Short snippet for the UI, with the match itself partially redacted. */
  preview: string;
}

export interface PrivacyLintResult {
  matches: PrivacyMatch[];
  /** True when any match was found — caller should treat as sensitive. */
  hasSecrets: boolean;
  /** True when the matches strongly suggest secrets (e.g., real-looking
      API key prefixes, BEGIN PRIVATE KEY, etc.). Cowork can block
      cloud dispatch entirely instead of just downgrading. */
  highConfidence: boolean;
}

/**
 * Patterns to detect. Order matters — we run them sequentially and
 * dedup by overlapping range.
 */
const PATTERNS: Array<{
  kind: PrivacyMatchKind;
  regex: RegExp;
  highConfidence: boolean;
}> = [
  // PEM private keys are unambiguous.
  {
    kind: 'private-key-pem',
    regex:
      /-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
    highConfidence: true,
  },
  // Common API-key prefixes — these are high-confidence and
  // shouldn't appear in any code that's not configured.
  {
    kind: 'env-key',
    // OpenAI sk-, Anthropic sk-ant-, Google AIza, GitHub ghp_, Slack xoxb,
    // Stripe sk_live_, Vercel vc_, Anthropic AUTH_TOKEN sk-ant-…
    regex:
      /(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}|xox[bp]-[A-Za-z0-9-]{10,}|sk_live_[A-Za-z0-9]{24,}|vc_[A-Za-z0-9]{32,})/g,
    highConfidence: true,
  },
  // JWTs — three base64-url segments dot-separated.
  {
    kind: 'jwt',
    regex:
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    highConfidence: true,
  },
  // .env-style block — ≥2 KEY=VALUE on consecutive lines.
  {
    kind: 'dotenv-block',
    regex:
      /(?:^|\n)\s*([A-Z_][A-Z0-9_]{2,})\s*=\s*['"]?([^\n'"]+)['"]?(?:\r?\n\s*([A-Z_][A-Z0-9_]{2,})\s*=\s*['"]?([^\n'"]+)['"]?)+/g,
    highConfidence: false,
  },
  // AWS secret access key — 40 chars of base64.
  {
    kind: 'aws-secret-key',
    regex: /\b[A-Za-z0-9+/]{40}\b/g,
    highConfidence: false,
  },
  // Private user paths.
  {
    kind: 'private-path',
    regex:
      /(?:\/home\/[a-zA-Z0-9._-]+|\/Users\/[a-zA-Z0-9._-]+|C:\\Users\\[a-zA-Z0-9._-]+)/g,
    highConfidence: false,
  },
];

/**
 * Scan a prompt for secrets. Returns matches with previews.
 */
export function scanForSecrets(prompt: string): PrivacyLintResult {
  const matches: PrivacyMatch[] = [];
  const seen: Array<[number, number]> = [];
  let highConfidence = false;

  for (const { kind, regex, highConfidence: hc } of PATTERNS) {
    // Reset lastIndex for each fresh match — patterns are stateful.
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(prompt)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Skip if this range overlaps with an earlier (higher priority) match.
      if (seen.some(([s, e]) => start < e && end > s)) continue;
      seen.push([start, end]);
      if (hc) highConfidence = true;
      matches.push({
        kind,
        start,
        end,
        preview: redactPreview(prompt, start, end),
      });
    }
  }

  return {
    matches,
    hasSecrets: matches.length > 0,
    highConfidence,
  };
}

/**
 * Build a ~80-char preview centered on the match, with the match
 * itself partially redacted ("sk-...xxxxx").
 */
function redactPreview(text: string, start: number, end: number): string {
  const before = text.slice(Math.max(0, start - 30), start);
  const matched = text.slice(start, end);
  const after = text.slice(end, Math.min(text.length, end + 30));
  const redacted =
    matched.length <= 8
      ? '****'
      : matched.slice(0, 4) + '…[redacted]…' + matched.slice(-4);
  return `${before}${redacted}${after}`.replace(/\s+/g, ' ').trim();
}
