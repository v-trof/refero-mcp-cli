import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const AUTH_SERVER = 'https://api.refero.design/.well-known/oauth-authorization-server';
const DEFAULT_SCOPE = 'read';

function configPath() {
  const root = process.env.REFERO_CONFIG_DIR || (process.platform === 'win32'
    ? process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming')
    : process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'));
  return path.join(root, 'refero', 'config.json');
}

async function readConfig() {
  try { return JSON.parse(await readFile(configPath(), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function writeConfig(config) {
  const filename = configPath();
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') await chmod(filename, 0o600);
}

export async function getStoredAuth() {
  return (await readConfig()).auth || null;
}

export async function getValidAccessToken({ fetchImpl = globalThis.fetch } = {}) {
  const auth = await getStoredAuth();
  if (!auth?.access_token) return undefined;
  const expiresAt = auth.expires_in && auth.obtained_at ? auth.obtained_at + auth.expires_in * 1000 : 0;
  if (!expiresAt || Date.now() < expiresAt - 60_000 || !auth.refresh_token || !auth.client_id) return auth.access_token;
  const metadata = await oauthMetadata(fetchImpl);
  const response = await fetchImpl(metadata.token_endpoint, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refresh_token, client_id: auth.client_id })
  });
  if (!response.ok) return auth.access_token;
  const refreshed = await response.json();
  if (!refreshed.access_token) return auth.access_token;
  const next = { ...auth, ...refreshed, refresh_token: refreshed.refresh_token || auth.refresh_token, client_id: auth.client_id, obtained_at: Date.now() };
  await saveAuth(next);
  return next.access_token;
}

export async function saveAuth(auth) {
  const config = await readConfig();
  await writeConfig({ ...config, auth });
}

export async function clearAuth() {
  const filename = configPath();
  const config = await readConfig();
  if (!config.auth) return;
  const { auth: _removed, ...remaining } = config;
  if (Object.keys(remaining).length) await writeConfig(remaining);
  else {
    try { await rm(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function base64url(buffer) {
  return buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function pkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function oauthMetadata(fetchImpl) {
  const response = await fetchImpl(AUTH_SERVER);
  if (!response.ok) throw new Error(`Could not load Refero OAuth metadata (${response.status}).`);
  return response.json();
}

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function waitForCallback(server, expectedState, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for Refero sign-in.'));
    }, timeoutMs);
    server.on('request', (request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback') { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Refero CLI</title><p>Signed in. You can close this window and return to your terminal.</p>');
      clearTimeout(timer);
      server.close();
      if (url.searchParams.get('state') !== expectedState) reject(new Error('Refero sign-in state did not match.'));
      else if (url.searchParams.get('error')) reject(new Error(`Refero sign-in failed: ${url.searchParams.get('error_description') || url.searchParams.get('error')}`));
      else if (!url.searchParams.get('code')) reject(new Error('Refero sign-in returned no authorization code.'));
      else resolve(url.searchParams.get('code'));
    });
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

export async function login({ fetchImpl = globalThis.fetch, browser = openBrowser, stdout = process.stdout } = {}) {
  const metadata = await oauthMetadata(fetchImpl);
  const state = base64url(randomBytes(24));
  const { verifier, challenge } = pkce();
  const server = createServer();
  const port = await listen(server);
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  let registration;
  try {
    const registrationResponse = await fetchImpl(metadata.registration_endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Refero CLI',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none'
      })
    });
    if (!registrationResponse.ok) throw new Error(`Refero OAuth client registration failed (${registrationResponse.status}).`);
    registration = await registrationResponse.json();
    const authorization = new URL(metadata.authorization_endpoint);
    authorization.search = new URLSearchParams({
      response_type: 'code', client_id: registration.client_id, redirect_uri: redirectUri,
      code_challenge: challenge, code_challenge_method: 'S256', scope: DEFAULT_SCOPE, state
    });
    stdout.write(`Opening Refero sign-in in your browser...\n`);
    browser(authorization.href);
    const code = await waitForCallback(server, state);
    const tokenResponse = await fetchImpl(metadata.token_endpoint, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: registration.client_id, code, redirect_uri: redirectUri, code_verifier: verifier })
    });
    if (!tokenResponse.ok) throw new Error(`Refero token exchange failed (${tokenResponse.status}).`);
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) throw new Error('Refero token exchange returned no access token.');
    await saveAuth({ ...tokens, client_id: registration.client_id, obtained_at: Date.now() });
    stdout.write(`Signed in successfully. Credentials saved to ${configPath()}\n`);
    return tokens;
  } catch (error) {
    server.close();
    throw error;
  }
}

export function authPath() { return configPath(); }
export { AUTH_SERVER };
