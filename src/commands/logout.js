'use strict';

const auth = require('../auth');
const C = require('../config');
const fs = require('node:fs');

async function runLogout(opts) {
  if (opts.all) {
    auth.logoutAll();
    process.stderr.write('Logged out of all environments.\n');
    return;
  }
  const envName = C.getEnv(opts.env);
  const a = auth.readAuth();
  if (a.environments && a.environments[envName]) {
    delete a.environments[envName];
    auth.writeAuth(a);
  }
  // Also remove pending-login if it matches.
  try { fs.unlinkSync(C.pendingLoginFile()); } catch (_) {}
  process.stderr.write(`Logged out of env=${envName}.\n`);
}

async function runReset(opts) {
  if (!opts.yes) {
    process.stderr.write("Pass --yes to confirm: this removes all Notion CLI data (auth, config, workspace cache, workers.json is left alone).\n");
    process.exit(1);
  }
  const files = [C.authFile(), C.configFile(), C.workspacesFile(), C.pendingLoginFile(), C.cacheFile(), C.openapiCacheFile()];
  for (const f of files) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
  process.stderr.write('All Notion CLI data removed.\n');
}

module.exports = { runLogout, runReset };
