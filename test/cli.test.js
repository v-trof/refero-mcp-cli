import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImage, extractToolPayload, McpClient } from '../src/mcp-client.js';
import { parseArgs } from '../src/cli.js';

test('parses positional arguments and long options', () => {
  const parsed = parseArgs(['search', 'screens', 'pricing', 'page', '--platform', 'web', '--page=2', '--json']);
  assert.deepEqual(parsed.positional, ['search', 'screens', 'pricing', 'page']);
  assert.deepEqual(parsed.options, { platform: 'web', page: '2', json: true });
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
