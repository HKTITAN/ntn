'use strict';

const { spawn } = require('node:child_process');

function openBrowser(url) {
  let cmd, args;
  if (process.platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '""', url.replace(/&/g, '^&')];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }
  try {
    const p = spawn(cmd, args, { stdio: 'ignore', detached: true });
    p.on('error', () => {});
    p.unref();
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { openBrowser };
