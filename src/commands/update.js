'use strict';

const { spawnSync } = require('node:child_process');

const REPO_SPEC = 'github:HKTITAN/ntn';

async function runUpdate(opts) {
  process.stderr.write(`Updating ntn via: npm install -g ${REPO_SPEC}\n`);
  const args = ['install', '-g', REPO_SPEC];
  const r = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error || r.status !== 0) {
    process.stderr.write(`Update failed. Manual fix: npm install -g ${REPO_SPEC}\n`);
    process.exit(1);
  }
}

module.exports = { runUpdate };
