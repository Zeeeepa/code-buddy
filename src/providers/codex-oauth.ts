import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import open from 'open';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const ISSUER = 'https://auth.openai.com';
const PORT = 1455;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;

interface CodexTokenData {
  id_token: string;
  access_token: string;
  refresh_token: string;
  account_id?: string;
}

interface CodexAuthDotJson {
  OPENAI_API_KEY?: string;
  tokens?: CodexTokenData;
  last_refresh?: string;
}

const AUTH_FILE_PATH = path.join(os.homedir(), '.codebuddy', 'codex-auth.json');

/**
 * Ensures the config directory exists.
 */
function ensureConfigDir() {
  const dir = path.dirname(AUTH_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Loads the saved tokens.
 */
function loadTokens(): CodexAuthDotJson | null {
  try {
    if (fs.existsSync(AUTH_FILE_PATH)) {
      const data = fs.readFileSync(AUTH_FILE_PATH, 'utf-8');
      return JSON.parse(data) as CodexAuthDotJson;
    }
  } catch (error) {
    console.error('Error reading codex-auth.json:', error);
  }
  return null;
}

/**
 * Saves tokens.
 */
function saveTokens(auth: CodexAuthDotJson) {
  try {
    ensureConfigDir();
    fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(auth, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing codex-auth.json:', error);
  }
}

/**
 * Clears saved tokens.
 */
export function clearCodexCredentials(): void {
  try {
    if (fs.existsSync(AUTH_FILE_PATH)) {
      fs.unlinkSync(AUTH_FILE_PATH);
    }
  } catch (error) {
    console.error('Error clearing codex credentials:', error);
  }
}

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Refreshes the token if needed.
 */
async function refreshToken(refreshTokenStr: string): Promise<CodexTokenData | null> {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshTokenStr);
    params.append('client_id', CLIENT_ID);

    const response = await fetch(`${ISSUER}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error('Failed to refresh Codex token:', await response.text());
      return null;
    }

    const data = await response.json() as CodexTokenData;
    return data;
  } catch (error) {
    console.error('Error refreshing Codex token:', error);
    return null;
  }
}

/**
 * Gets tokens, optionally forcing a login if none exist or if forceLogin is true.
 */
export async function getCodexOauthTokens(forceLogin = false): Promise<string | null> {
  const currentAuth = loadTokens();

  if (!forceLogin && currentAuth?.tokens?.access_token) {
    // We have tokens. Let's try to just return them.
    // In a real implementation we would check the JWT expiry. For now, we refresh opportunistically if it's been a while, or just trust it until it fails.
    // Let's do a simple expiry check or just refresh. We'll refresh if last_refresh is > 1 hour ago.
    const lastRefresh = currentAuth.last_refresh ? new Date(currentAuth.last_refresh).getTime() : 0;
    const now = Date.now();
    
    // If older than 1 hour (3600000 ms), try to refresh
    if (now - lastRefresh > 3600000) {
      const refreshed = await refreshToken(currentAuth.tokens.refresh_token);
      if (refreshed) {
        currentAuth.tokens = refreshed;
        currentAuth.last_refresh = new Date().toISOString();
        saveTokens(currentAuth);
        return refreshed.access_token;
      } else {
        // Refresh failed, we might need to login again
        if (!forceLogin) return null;
      }
    } else {
      return currentAuth.tokens.access_token;
    }
  }

  if (!forceLogin) {
    return null;
  }

  // Perform OAuth Flow
  return new Promise((resolve, reject) => {
    // Generate PKCE
    const verifierBuffer = crypto.randomBytes(32);
    const codeVerifier = base64URLEncode(verifierBuffer);
    
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = base64URLEncode(hash);

    const state = base64URLEncode(crypto.randomBytes(16));

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      if (url.pathname !== '/auth/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (!code || returnedState !== state) {
        res.writeHead(400);
        res.end('Invalid request');
        server.close();
        reject(new Error('Invalid code or state mismatch'));
        return;
      }

      // Exchange code for tokens
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);
        params.append('client_id', CLIENT_ID);
        params.append('code_verifier', codeVerifier);

        const tokenRes = await fetch(`${ISSUER}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (!tokenRes.ok) {
          throw new Error('Failed to exchange token: ' + await tokenRes.text());
        }

        const tokens = await tokenRes.json() as CodexTokenData;
        const newAuth: CodexAuthDotJson = {
          tokens,
          last_refresh: new Date().toISOString()
        };
        saveTokens(newAuth);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Successfully authenticated with ChatGPT (Codex)!</h1>
              <p>You can now close this tab and return to Code Buddy.</p>
              <script>window.close();</script>
            </body>
          </html>
        `);
        
        server.close();
        resolve(tokens.access_token);
      } catch (err) {
        res.writeHead(500);
        res.end('Internal Server Error: ' + (err as Error).message);
        server.close();
        reject(err);
      }
    });

    server.listen(PORT, async () => {
      // Build Auth URL
      const authUrl = new URL(`${ISSUER}/oauth/authorize`);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', CLIENT_ID);
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('scope', 'openid profile email offline_access api.connectors.read api.connectors.invoke');
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('id_token_add_organizations', 'true');
      authUrl.searchParams.append('codex_cli_simplified_flow', 'true');
      authUrl.searchParams.append('state', state);

      try {
        await open(authUrl.toString());
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}
