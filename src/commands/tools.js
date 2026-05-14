'use strict';

const C = require('../config');
const { workersRequest } = require('../http');
const { printJson, die } = require('../output');

async function readStdinJson() {
  if (process.stdin.isTTY) return null;
  return await new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => buf += d);
    process.stdin.on('end', () => {
      if (!buf.trim()) return resolve(null);
      try { resolve(JSON.parse(buf)); } catch (_) { reject(new Error('Invalid JSON from stdin')); }
    });
    process.stdin.on('error', reject);
  });
}

async function runTools(sub, name, opts) {
  if (sub !== 'call') die(`Unknown tools subcommand '${sub}'. Use: call.`);
  if (!name) die('Missing <tool-name>.');
  let input = null;
  if (opts.data) {
    try { input = JSON.parse(opts.data); }
    catch (e) { die(`Invalid JSON in --data: ${e.message}`); }
  } else {
    input = await readStdinJson();
  }
  if (input === null) input = {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    die('Tool input must be a JSON object. Pass `{}` for no args.');
  }
  const env = C.getEnv(opts.env);
  const res = await workersRequest({
    action: 'RunCapability',
    body: { toolName: name, input },
    envName: env,
  });
  printJson(res);
}

module.exports = { runTools };
