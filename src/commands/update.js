'use strict';

const { spawnSync } = require('node:child_process');

async function runUpdate(opts) {
  // Pure-JS port — update via npm.
  const args = ['install', '-g', 'ntn@latest'];
  process.stderr.write('Updating ntn via: npm install -g ntn@latest\n');
  const r = spawnSync('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error || r.status !== 0) {
    process.stderr.write('Update failed. You can also reinstall via: npm install -g ntn\n');
    process.exit(1);
  }
}

module.exports = { runUpdate };
