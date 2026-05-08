#!/usr/bin/env node
/**
 * Probe which Codex Responses models the current ChatGPT account can
 * actually call. Reads the OAuth token from ~/.codebuddy/codex-auth.json
 * and POSTs a minimal request for each candidate slug.
 *
 * Usage: node scripts/probe-codex-models.mjs
 *
 * Output:
 *   ✅ <model>     — works
 *   ❌ <model>     — backend error (with reason)
 *   ⚠️  <model>     — network/parsing failure
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const AUTH_PATH = path.join(os.homedir(), '.codebuddy', 'codex-auth.json');
const RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';

// Candidates to probe — roughly ordered from most-likely to least-likely
// for a ChatGPT subscription account. We include the bare slugs (no
// `-codex` suffix) since the suffixed variants already failed for Patrice.
const CANDIDATES = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3',
  'gpt-5.1',
  'gpt-5',
  'gpt-5-codex',
  'gpt-5.1-codex',
  'gpt-5-codex-latest',
  'codex-1',
  'codex-mini-latest',
  'o3',
  'o3-mini',
  'o1',
  'gpt-4o',
  'gpt-4.1',
];

function loadAuth() {
  if (!fs.existsSync(AUTH_PATH)) {
    console.error(`No auth file at ${AUTH_PATH}. Run \`node dist/index.js login chatgpt\` first.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf-8'));
  if (!raw?.tokens?.access_token) {
    console.error('Auth file present but no access_token. Re-login required.');
    process.exit(1);
  }
  return raw.tokens;
}

function decodeIdTokenAccount(idToken) {
  try {
    const payload = idToken.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf-8');
    const claims = JSON.parse(json);
    return claims['https://api.openai.com/auth']?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

async function probeOne(model, tokens, accountId) {
  const headers = {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    originator: 'codex_cli_rs',
    'User-Agent': 'codebuddy-probe/1.0',
  };
  if (accountId) headers['ChatGPT-Account-ID'] = accountId;

  const body = {
    model,
    instructions: 'Answer with one word.',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hi' }],
      },
    ],
    store: false,
    stream: true,
  };

  try {
    const res = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      // Drain the stream briefly to confirm it's a real success.
      const text = await res.text();
      const firstLine = text.split('\n').find((l) => l.startsWith('data:')) ?? '';
      return { ok: true, status: res.status, sample: firstLine.slice(0, 80) };
    }

    const errText = await res.text();
    let detail = errText;
    try {
      const parsed = JSON.parse(errText);
      detail = parsed.detail ?? parsed.error?.message ?? errText;
    } catch {
      /* keep raw */
    }
    return { ok: false, status: res.status, detail: String(detail).slice(0, 200) };
  } catch (err) {
    return { ok: false, status: 0, detail: `network: ${err.message}` };
  }
}

(async () => {
  const tokens = loadAuth();
  const accountId = tokens.account_id ?? decodeIdTokenAccount(tokens.id_token);

  console.log(`Probing ${CANDIDATES.length} model slugs against ${RESPONSES_URL}`);
  console.log(`Account: ${accountId ?? '(no account_id in id_token)'}\n`);

  const works = [];
  for (const model of CANDIDATES) {
    process.stdout.write(`  ${model.padEnd(24)} ... `);
    const r = await probeOne(model, tokens, accountId);
    if (r.ok) {
      works.push(model);
      console.log(`✅  ${r.status}  ${r.sample}`);
    } else {
      console.log(`❌  ${r.status}  ${r.detail}`);
    }
  }

  console.log('\n─────────────────────────────────────────');
  if (works.length === 0) {
    console.log('No model accepted. The backend may require a different scope or plan tier.');
  } else {
    console.log('Models accepted by your account:');
    for (const m of works) console.log(`   • ${m}`);
    console.log(`\nUse the first one as default: \`buddy --model ${works[0]}\``);
  }
})();
