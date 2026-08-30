import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { extractImage, extractToolPayload, McpClient } from '../src/mcp-client.js';
import { parseArgs, run } from '../src/cli.js';
import { getStoredAuth, login, TOKEN_PAGE } from '../src/auth.js';

test('parses positional arguments and long options', () => {
  const parsed = parseArgs(['search', 'screens', 'pricing', 'page', '--platform', 'web', '--page=2', '--json']);
  assert.deepEqual(parsed.positional, ['search', 'screens', 'pricing', 'page']);
  assert.deepEqual(parsed.options, { platform: 'web', page: '2', json: true });
});

test('returns the bundled agent skill without making a network request', async () => {
  const stdout = { output: '', write(value) { this.output += value; } };
  await run(['skill'], { stdout, fetchImpl: async () => { throw new Error('network should not be used'); } });
  assert.match(stdout.output, /^---\nname: refero-design/);
  assert.match(stdout.output, /refero search styles/);
  assert.match(stdout.output, /Research before design work/);
});

test('extracts structured content, JSON text, and plain text', () => {
  assert.deepEqual(extractToolPayload({ structuredContent: { ok: true } }), { ok: true });
  assert.deepEqual(extractToolPayload({ content: [{ type: 'text', text: '{"ok":true}' }] }), { ok: true });
  assert.equal(extractToolPayload({ content: [{ type: 'text', text: '# Style' }] }), '# Style');
});

test('extracts an image content block', () => {
  assert.deepEqual(extractImage({ content: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }] }), { data: 'aGVsbG8=', mimeType: 'image/png' });
  assert.throws(() => extractImage({ content: [] }), /no image data/);
});

test('initializes an MCP session and calls a tool', async () => {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ body, headers: init.headers });
    if (body.method === 'initialize') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26' } }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'mcp-session-id': 'session-test' }
      });
    }
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{"records":[]}' }] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const client = new McpClient({ token: 'secret', fetchImpl });
  const result = await client.callTool('refero_search_styles', { query: 'editorial', page: 1, response_format: 'json' });
  assert.deepEqual(extractToolPayload(result), { records: [] });
  assert.equal(requests[0].body.method, 'initialize');
  assert.equal(requests[1].body.method, 'notifications/initialized');
  assert.equal(requests[2].body.method, 'tools/call');
  assert.equal(requests[2].body.params.name, 'refero_search_styles');
  assert.equal(requests[2].headers.get('Authorization'), 'Bearer secret');
  assert.equal(requests[2].headers.get('Mcp-Session-Id'), 'session-test');
});

test('maps every documented research command to the current MCP tool contract', async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'tools/call') calls.push(body.params);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{}' }] } }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'test' } });
  };
  const stdout = { output: '', write(value) { this.output += value; } };
  const commands = [
    ['search', 'styles', 'editorial monochrome'],
    ['search', 'screens', 'pricing page', '--platform', 'web'],
    ['search', 'flows', 'signup onboarding', '--platform', 'ios'],
    ['get', 'style', 'style-id'],
    ['get', 'screen', 'screen-a', 'screen-b'],
    ['get', 'flow', '11201', '11202'],
    ['similar', 'screen-a', '--limit', '5']
  ];
  for (const command of commands) await run(command, { fetchImpl, stdout });
  assert.deepEqual(calls.map(({ name }) => name), [
    'refero_search_styles', 'refero_search_screens', 'refero_search_flows',
    'refero_get_style', 'refero_get_screen', 'refero_get_flow', 'refero_get_similar_screens'
  ]);
  assert.deepEqual(calls[2].arguments, { query: 'signup onboarding', page: 1, response_format: 'md', platform: 'ios' });
  assert.deepEqual(calls[5].arguments, { flow_ids: [11201, 11202], response_format: 'md' });
  assert.deepEqual(calls[6].arguments, { screen_id: 'screen-a', limit: 5, response_format: 'md' });
});

test('token login opens Refero and stores the pasted API token', async () => {
  const configDir = await mkdtemp(join(tmpdir(), 'refero-cli-'));
  const previousConfigDir = process.env.REFERO_CONFIG_DIR;
  process.env.REFERO_CONFIG_DIR = configDir;
  try {
    const stdout = { output: '', write(value) { this.output += value; } };
    const stdin = Readable.from(['test-api-token\n']);
    let opened;
    await login({ stdin, stdout, browser: (url) => { opened = url; } });
    assert.equal(opened, TOKEN_PAGE);
    assert.equal((await getStoredAuth()).access_token, 'test-api-token');
  } finally {
    if (previousConfigDir === undefined) delete process.env.REFERO_CONFIG_DIR;
    else process.env.REFERO_CONFIG_DIR = previousConfigDir;
    await rm(configDir, { recursive: true, force: true });
  }
});
