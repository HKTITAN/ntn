'use strict';

const fs = require('node:fs');
const inline = require('../inline-args');
const C = require('../config');
const { publicRequest } = require('../http');
const { printJson, die } = require('../output');

// httpie-style 'ntn api <path> [args...]' command.
// Auto-method: POST when body present, GET otherwise. -X/--method always wins.

const PUBLIC_API_DOCS_BASE = process.env.NOTION_API_DOCS_BASE_URL || 'https://developers.notion.com';
const SUPPORTED_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

async function readStdinJson() {
  if (process.stdin.isTTY) return null;
  return await new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => buf += d);
    process.stdin.on('end', () => {
      if (!buf.trim()) return resolve(null);
      try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('Invalid JSON from stdin')); }
    });
    process.stdin.on('error', reject);
  });
}

async function runApi(pathArg, opts, rawArgs) {
  if (pathArg === 'ls') return runApiLs(opts);
  if (!pathArg) die("Missing <path>. Try `ntn api ls` for the list of endpoints.");

  let parsed;
  try { parsed = inline.parse(rawArgs); }
  catch (e) { die(e.message); }

  if (parsed.unknown.length) {
    process.stderr.write(`warning: unrecognized inline args: ${parsed.unknown.join(' ')}\n` +
      `Use 'Header:Value', 'name==value', 'path=value', or 'path:=json'.\n`);
  }

  let body = null;
  let bodySource = null;
  if (parsed.hasBody) { body = parsed.body; bodySource = 'inline'; }

  if (opts.data) {
    if (bodySource) die('Body JSON must come from exactly one source: stdin, --data, or inline body inputs.');
    try { body = JSON.parse(opts.data); bodySource = 'data'; }
    catch (e) { die(`Invalid JSON in --data: ${e.message}`); }
  }

  // Try stdin only if no other body and stdin is piped
  if (!bodySource) {
    try {
      const stdinBody = await readStdinJson();
      if (stdinBody !== null) { body = stdinBody; bodySource = 'stdin'; }
    } catch (e) { die(e.message); }
  }

  let method = opts.method ? String(opts.method).toUpperCase() : (body ? 'POST' : 'GET');
  if (!SUPPORTED_METHODS.includes(method)) {
    die(`Unsupported method '${method}'. Use ${SUPPORTED_METHODS.join(', ')}.`);
  }

  if (opts.spec || opts.docs) {
    return runApiInfo(pathArg, method, opts);
  }

  try {
    const res = await publicRequest({
      method,
      endpoint: pathArg,
      body,
      headers: parsed.headers,
      query: parsed.query,
      envName: C.getEnv(opts.env),
    });
    printJson(res);
  } catch (e) {
    if (e.status) {
      process.stderr.write(`API ${e.status}\n`);
      if (e.body) printJson(e.body);
      process.exit(1);
    }
    die(e.message);
  }
}

async function runApiLs(opts) {
  // Best-effort: fetch the OpenAPI spec live and print operation list. Cache to disk.
  const spec = await loadOpenApiSpec();
  const rows = [];
  for (const [p, ops] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) continue;
      rows.push({ method: method.toUpperCase(), path: p, summary: op.summary || op.operationId || '' });
    }
  }
  rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  if (opts.json) return printJson(rows);
  for (const r of rows) {
    process.stdout.write(`${r.method.padEnd(6)} ${r.path.padEnd(48)} ${r.summary}\n`);
  }
}

async function runApiInfo(pathArg, method, opts) {
  const spec = await loadOpenApiSpec();
  const pathItem = spec.paths && spec.paths[normalizeOpenApiPath(pathArg, spec)];
  if (!pathItem) die(`Path '${pathArg}' not found in OpenAPI spec. Try 'ntn api ls'.`);
  const op = pathItem[method.toLowerCase()];
  if (!op) die(`Operation ${method} ${pathArg} not found in OpenAPI spec.`);
  if (opts.spec) return printJson(op);
  if (opts.docs) {
    const ref = op['x-notion-docs-ref'];
    if (ref) {
      process.stdout.write(`${PUBLIC_API_DOCS_BASE}/${String(ref).replace(/^\//, '')}\n`);
    } else {
      process.stdout.write(`No x-notion-docs-ref on ${method} ${pathArg}.\n`);
    }
  }
}

function normalizeOpenApiPath(p, spec) {
  // Caller may have passed concrete IDs; map them back to templated paths.
  if (spec.paths && spec.paths[p]) return p;
  const tpl = '/' + p.replace(/^\//, '');
  if (spec.paths && spec.paths[tpl]) return tpl;
  // Try to match by template: replace UUID-like segments with {var}.
  const segs = p.replace(/^\//, '').split('/');
  for (const k of Object.keys(spec.paths || {})) {
    const kSegs = k.replace(/^\//, '').split('/');
    if (kSegs.length !== segs.length) continue;
    let ok = true;
    for (let i = 0; i < kSegs.length; i++) {
      if (kSegs[i].startsWith('{') && kSegs[i].endsWith('}')) continue;
      if (kSegs[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return k;
  }
  return p;
}

async function loadOpenApiSpec() {
  const cacheFile = C.openapiCacheFile();
  // Try live fetch first
  try {
    const res = await fetch('https://developers.notion.com/openapi.json', { headers: { 'User-Agent': 'ntn-node' } });
    if (res.ok) {
      const j = await res.json();
      try {
        C.ensureDir(require('node:path').dirname(cacheFile));
        fs.writeFileSync(cacheFile, JSON.stringify(j));
      } catch (_) {}
      return j;
    }
  } catch (_) {}
  // Fall back to cache
  if (fs.existsSync(cacheFile)) {
    process.stderr.write('warning: falling back to a stale cached OpenAPI spec.\n');
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  die('Could not load OpenAPI spec (no network and no cached copy).');
}

module.exports = { runApi };
