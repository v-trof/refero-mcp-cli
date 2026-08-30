#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { McpClient, ReferoError, DEFAULT_URL, extractImage, extractToolPayload } from './mcp-client.js';

const HELP = `Refero CLI — design research from your terminal

Usage:
  refero search styles <query> [--page N] [--json]
  refero search screens <query> --platform web|ios [--page N] [--json]
  refero search flows <query> --platform web|ios [--page N] [--json]
  refero get style|screen|flow <id> [<id> ...] [--json]
  refero similar <screen-uuid> [--limit N] [--json]
  refero image <screen-uuid> [--size thumbnail|full] [--output FILE]

Environment:
  REFERO_TOKEN       Bearer token for Refero MCP
  REFERO_MCP_URL     MCP endpoint (default: ${DEFAULT_URL})

Global options:
  --token TOKEN      Bearer token (overrides REFERO_TOKEN)
  --json             Print machine-readable JSON
  --help             Show this help
`;

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (item.startsWith('--')) {
      const [key, inline] = item.slice(2).split('=', 2);
      if (['json', 'help'].includes(key)) options[key] = true;
      else {
        const value = inline ?? argv[++i];
        if (!value || value.startsWith('--')) throw new ReferoError(`Missing value for --${key}`);
        options[key] = value;
      }
    } else positional.push(item);
  }
  return { positional, options };
}

function need(value, label) {
  if (!value) throw new ReferoError(`Missing ${label}. Use --help for usage.`);
  return value;
}

function integer(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new ReferoError(`${label} must be a positive integer.`);
  return parsed;
}

function ids(value, label) {
  const values = value.split(',').map((id) => id.trim()).filter(Boolean);
  if (!values.length || values.length > 10) throw new ReferoError(`${label} accepts 1–10 ids.`);
  return values;
}

function printPayload(payload, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (typeof payload === 'string') {
    process.stdout.write(`${payload.trim()}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
}

async function run(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const { positional, options } = parseArgs(argv);
  if (options.help || positional.length === 0 || positional[0] === 'help') {
    stdout.write(HELP);
    return;
  }
  const [command, kind, ...rest] = positional;
  const token = options.token || process.env.REFERO_TOKEN || process.env.REFERO_API_KEY;
  const client = new McpClient({ url: process.env.REFERO_MCP_URL || DEFAULT_URL, token, fetchImpl: io.fetchImpl });
  let result;

  if (command === 'search') {
    const query = need(rest.join(' '), 'query');
    const normalized = kind.toLowerCase();
    const tool = { styles: 'refero_search_styles', style: 'refero_search_styles', screens: 'refero_search_screens', screen: 'refero_search_screens', flows: 'refero_search_flows', flow: 'refero_search_flows' }[normalized];
    if (!tool) throw new ReferoError('Search target must be styles, screens, or flows.');
    const args = { query, page: options.page ? integer(options.page, '--page') : 1, response_format: options.json ? 'json' : 'md' };
    if (tool !== 'refero_search_styles') args.platform = need(options.platform, '--platform');
    if (args.platform && !['web', 'ios'].includes(args.platform)) throw new ReferoError('--platform must be web or ios.');
    result = await client.callTool(tool, args);
  } else if (command === 'get') {
    const target = { styles: 'refero_get_style', style: 'refero_get_style', screens: 'refero_get_screen', screen: 'refero_get_screen', flows: 'refero_get_flow', flow: 'refero_get_flow' }[kind.toLowerCase()];
    if (!target) throw new ReferoError('Get target must be style, screen, or flow.');
    const values = ids(need(rest.join(','), 'id'), 'id');
    const key = target.includes('style') ? 'style' : target.includes('screen') ? 'screen' : 'flow';
    const args = { [`${key}_ids`]: values, response_format: options.json ? 'json' : 'md' };
    if (values.length === 1) { delete args[`${key}_ids`]; args[`${key}_id`] = values[0]; }
    result = await client.callTool(target, args);
  } else if (command === 'similar') {
    const screenId = need(kind, 'screen UUID');
    result = await client.callTool('refero_get_similar_screens', { screen_id: screenId, limit: options.limit ? integer(options.limit, '--limit') : 10, response_format: options.json ? 'json' : 'md' });
  } else if (command === 'image') {
    const screenId = need(kind, 'screen UUID');
    const size = options.size || 'thumbnail';
    if (!['thumbnail', 'full'].includes(size)) throw new ReferoError('--size must be thumbnail or full.');
    const image = extractImage(await client.callTool('refero_get_screen_image', { screen_id: screenId, image_size: size }));
    const output = options.output || `${screenId}.png`;
    const extension = image.mimeType.includes('jpeg') ? '.jpg' : image.mimeType.includes('webp') ? '.webp' : '.png';
    const destination = output.includes('.') ? output : `${output}${extension}`;
    await writeFile(destination, Buffer.from(image.data, 'base64'));
    stdout.write(`${destination}\n`);
    return;
  } else {
    throw new ReferoError(`Unknown command: ${command}. Use --help for usage.`);
  }
  printPayload(extractToolPayload(result), options.json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`refero: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export { HELP, parseArgs, run };
