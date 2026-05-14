'use strict';

const fs = require('node:fs');
const C = require('../config');
const auth = require('../auth');
const { printJson } = require('../output');

async function runDoctor(opts) {
  const checks = [];
  const env = C.getEnv(opts.env);

  const [maj] = process.versions.node.split('.').map(Number);
  checks.push({ name: 'Node version', ok: maj >= 18, value: `${process.versions.node} (need >= 18)` });
  checks.push({ name: 'Platform', ok: true, value: `${process.platform}-${process.arch}` });
  const depCount = Object.keys(require('../../package.json').dependencies || {}).length;
  checks.push({
    name: 'npm dependencies',
    ok: true,
    value: depCount === 0 ? '0 — using built-in Node APIs, already available' : `${depCount} installed`,
  });
  checks.push({ name: 'NOTION_HOME', ok: !!C.notionHome(), value: C.notionHome() });
  checks.push({ name: 'Auth file', ok: fs.existsSync(C.authFile()), value: C.authFile() });
  checks.push({ name: 'NOTION_API_TOKEN env', ok: !!process.env.NOTION_API_TOKEN, value: process.env.NOTION_API_TOKEN ? '(set)' : '(unset)' });
  const t = auth.getWorkspaceToken(env);
  checks.push({ name: `Workspace token (${env})`, ok: !!t, value: t ? `${t.spaceName || ''} (${t.spaceId})`.trim() : '(none)' });

  // Public API reachability
  try {
    const res = await fetch(`${C.apiBaseUrl(env)}/v1/users/me`, {
      headers: {
        'Authorization': `Bearer ${auth.getApiToken(env) || ''}`,
        'Notion-Version': C.NOTION_VERSION,
      },
    });
    checks.push({ name: 'Public API reachable', ok: res.status !== 0, value: `HTTP ${res.status}` });
  } catch (e) {
    checks.push({ name: 'Public API reachable', ok: false, value: e.message });
  }

  if (opts.json) return printJson(checks);
  for (const c of checks) {
    process.stdout.write(`${c.ok ? '✓' : '✗'} ${c.name}: ${c.value}\n`);
  }
}

module.exports = { runDoctor };
