#!/usr/bin/env node
'use strict';

// Post-install check: this CLI is pure Node with zero runtime npm deps,
// so all "dependencies" reduce to a Node version check. Report status
// so the user knows the install is healthy.

const REQUIRED_NODE_MAJOR = 18;
const [maj, min, patch] = process.versions.node.split('.').map(Number);

if (maj < REQUIRED_NODE_MAJOR) {
  process.stderr.write(
    `\nntn requires Node.js ${REQUIRED_NODE_MAJOR}+ for built-in fetch and AbortController.\n` +
    `You are on Node ${process.versions.node}. Please upgrade Node from https://nodejs.org\n` +
    `and re-run: npm install -g github:HKTITAN/ntn\n\n`
  );
  process.exit(1);
}

const pkg = require('../package.json');
const depCount = Object.keys(pkg.dependencies || {}).length;

process.stdout.write(
  `\nntn ${pkg.version} installed.\n` +
  `  - Node ${process.versions.node} ✓ (>= ${REQUIRED_NODE_MAJOR})\n` +
  `  - Runtime npm dependencies: ${depCount === 0 ? '0 (all required APIs are built into Node ≥ 18) — already available ✓' : depCount}\n` +
  `  - Platform: ${process.platform}-${process.arch} ✓\n\n` +
  `Run \`ntn --help\` to get started, or \`ntn login\` to authenticate.\n\n`
);
