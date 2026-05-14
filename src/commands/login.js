'use strict';

const C = require('../config');
const auth = require('../auth');
const { workersUnauthRequest } = require('../http');
const { openBrowser } = require('../browser');

const POLL_INTERVAL_MS = 2000;
const FALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

async function loginInit(envName) {
  return await workersUnauthRequest({
    action: 'CliLoginInit',
    envName,
    body: {
      cliVersion: require('../../package.json').version,
      platform: `${process.platform}-${process.arch}`,
      hostname: require('node:os').hostname(),
    },
  });
}

async function loginRedeem(envName, sessionId) {
  return await workersUnauthRequest({
    action: 'CliLoginRedeem',
    envName,
    body: { sessionId },
  });
}

function savePending(envName, sessionId, verificationCode, expiresAt) {
  C.writeJson(C.pendingLoginFile(), {
    sessionId,
    verificationCode,
    environment: envName,
    expiresAt,
    startedAt: new Date().toISOString(),
  });
}

function loadPending() {
  return C.readJson(C.pendingLoginFile(), null);
}

function clearPending() {
  const fs = require('node:fs');
  try { fs.unlinkSync(C.pendingLoginFile()); } catch (_) {}
}

async function pollUntilConfirmed(envName, sessionId, verificationCode, expiresAtStr) {
  process.stderr.write(`Waiting for confirmation... (verification code: ${verificationCode})\n`);
  const expiresAt = expiresAtStr ? new Date(expiresAtStr).getTime() : (Date.now() + FALLBACK_TIMEOUT_MS);
  while (Date.now() < expiresAt) {
    let res;
    try {
      res = await loginRedeem(envName, sessionId);
    } catch (e) {
      // Transient errors: log and continue polling unless verbose
      if (process.env.NTN_VERBOSE) process.stderr.write(`(redeem error: ${e.message})\n`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }
    if (process.env.NTN_VERBOSE) process.stderr.write(`(redeem: ${JSON.stringify(res)})\n`);
    const status = String(res && res.status || '').toLowerCase();
    if (status === 'confirmed') return res;
    if (status === 'expired') {
      throw new Error("Login session expired. Run 'ntn login' to start a new one.");
    }
    // status === 'pending' or unknown -> wait
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Login was not completed in time.');
}

function saveConfirmed(envName, confirmed) {
  const token = confirmed.token;
  const spaceId = confirmed.spaceId;
  const spaceName = confirmed.spaceName || '';
  if (!token || !spaceId) {
    throw new Error(`Login redeem returned an unexpected payload: ${JSON.stringify(confirmed)}`);
  }
  auth.saveWorkspaceToken(envName, spaceId, token, null, spaceName);
  return { spaceId, spaceName };
}

async function runLogin(opts) {
  const envName = C.getEnv(opts.env);
  process.stderr.write('Starting login flow...\n');
  let init;
  try {
    init = await loginInit(envName);
  } catch (e) {
    process.stderr.write(`Login init failed: ${e.message}\n`);
    process.exit(1);
  }
  const sessionId = init.sessionId;
  const verificationCode = init.verificationCode || '';
  const browserUrl = init.browserUrl || init.authorizationUrl;
  const expiresAt = init.expiresAt || null;
  if (!sessionId || !browserUrl) {
    process.stderr.write(`Login init response missing required fields:\n${JSON.stringify(init, null, 2)}\n`);
    process.exit(1);
  }
  savePending(envName, sessionId, verificationCode, expiresAt);

  process.stderr.write('Opening browser to log in. Confirm that this verification code matches\n');
  process.stderr.write('what you see in the browser:\n\n');
  process.stderr.write(`    ${verificationCode}\n\n`);
  const opened = openBrowser(browserUrl);
  if (!opened) {
    process.stderr.write('Could not open browser automatically. Please visit:\n');
    process.stderr.write(`  ${browserUrl}\n\n`);
  } else {
    process.stderr.write(`If the browser did not open, visit:\n  ${browserUrl}\n\n`);
  }
  process.stderr.write('After completing the flow in your browser, return to the CLI.\n');

  try {
    const confirmed = await pollUntilConfirmed(envName, sessionId, verificationCode, expiresAt);
    const { spaceId, spaceName } = saveConfirmed(envName, confirmed);
    clearPending();
    process.stderr.write(`Authenticated! Workspace ${spaceName ? `'${spaceName}' (${spaceId})` : spaceId} saved for env=${envName}.\n`);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.stderr.write("Run 'ntn login poll' to try again, or 'ntn login' to start a new session.\n");
    process.exit(1);
  }
}

async function runLoginPoll(opts) {
  const pending = loadPending();
  if (!pending) {
    process.stderr.write("No pending login session found.\nRun 'ntn login' first to start a new login session.\n");
    process.exit(1);
  }
  const envName = C.getEnv(opts.env || pending.environment);
  try {
    const confirmed = await pollUntilConfirmed(envName, pending.sessionId, pending.verificationCode, pending.expiresAt);
    const { spaceId, spaceName } = saveConfirmed(envName, confirmed);
    clearPending();
    process.stderr.write(`Authenticated! Workspace ${spaceName ? `'${spaceName}' (${spaceId})` : spaceId} saved for env=${envName}.\n`);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { runLogin, runLoginPoll };
