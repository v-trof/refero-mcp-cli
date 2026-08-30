import { mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const TOKEN_PAGE = 'https://refero.design/mcp';

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

export async function getValidAccessToken() {
  return (await getStoredAuth())?.access_token;
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

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

export async function login({ stdin = process.stdin, stdout = process.stdout, browser = openBrowser } = {}) {
  stdout.write(`Open ${TOKEN_PAGE} and copy the API token shown there.\n`);
  browser(TOKEN_PAGE);
  const readline = createInterface({ input: stdin, output: stdout, terminal: Boolean(stdin.isTTY && stdout.isTTY) });
  try {
    const token = (await readline.question('Paste token: ')).trim();
    if (!token) throw new Error('No token entered. Run `refero auth login` again.');
    await saveAuth({ access_token: token, kind: 'api_token', obtained_at: Date.now() });
    stdout.write(`Token saved to ${configPath()}\n`);
    return token;
  } finally {
    readline.close();
  }
}

export function authPath() { return configPath(); }
export { TOKEN_PAGE };
