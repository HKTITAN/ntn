'use strict';

function printJson(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function printTable(rows, columns, { plain = false } = {}) {
  if (!rows.length) return;
  const widths = columns.map(c => Math.max(c.header.length, ...rows.map(r => String(r[c.key] ?? '').length)));
  const sep = plain ? '\t' : '  ';
  if (!plain) {
    process.stdout.write(columns.map((c, i) => c.header.padEnd(widths[i])).join(sep) + '\n');
  }
  for (const r of rows) {
    process.stdout.write(columns.map((c, i) => plain ? String(r[c.key] ?? '') : String(r[c.key] ?? '').padEnd(widths[i])).join(sep) + '\n');
  }
}

function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

module.exports = { printJson, printTable, die };
