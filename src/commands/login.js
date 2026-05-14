'use strict';

const readline = require('node:readline');
const C = require('../config');
const auth = require('../auth');
const { workersUnauthRequest, workersRequest } = require('../http');
const { openBrowser } = require('../browser');

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function loginInit(envName) {
  const res = await workersUnauthRequest({
    action: 'CliLoginInit',
    envName,
    body: {
      cliVersion: require('../../package.json').version,
      platform: `${process.platform}-${process.arch}`,
      hostname: require('node:os').hostname(),
    },
  });
  // Expected fields: sessionId, browserUrl OR authorizationUrl, verificationCode
  return res;
}

async function loginRedeem(envName, sessionId) {
  return await workersUnauthRequest({
    action: 'CliLoginRedeem',
    envName,
    body: { sessionId },
  });
}

function savePending(envName, sessionId, verificationCode) {
  C.writeJson(C.pendingLoginFile(), {
    sessionId,
    verificationCode,
    environment: envName,
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

async function pollUntilConfirmed(envName, sessionId, verificationCode) {
  process.stderr.write(`Waiting for confirmation... (verification code: ${verificationCode})\n`);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    let res;
    try {
      res = await loginRedeem(envName, sessionId);
    } catch (e) {
      process.stderr.write(`Login redeem failed: ${e.message}\n`);
      throw e;
    }
    // Internally-tagged enum: { status: "Pending" | "Confirmed" | "Expired", ... }
    const status = res.status || res.kind || res.type;
    if (status === 'Confirmed' || res.accessToken) {
      return res;
    }
    if (status === 'Expired') {
      throw new Error("Login session expired. Run 'ntn login' to start a new one.");
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Login was not completed in time.');
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
  if (!sessionId || !browserUrl) {
    process.stderr.write(`Login init response missing required fields:\n${JSON.stringify(init, null, 2)}\n`);
    process.exit(1);
  }
  savePending(envName, sessionId, verificationCode);

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
    const confirmed = await pollUntilConfirmed(envName, sessionId, verificationCode);
    const workspaceId = confirmed.workspaceId || confirmed.workspace_id;
    const accessToken = confirmed.accessToken || confirmed.access_token;
    const expiresAt = confirmed.expiresAt || confirmed.expires_at || null;
    if (!workspaceId || !accessToken) {
      process.stderr.write(`Login redeem returned an unexpected payload:\n${JSON.stringify(confirmed, null, 2)}\n`);
      process.exit(1);
    }
    auth.saveWorkspaceToken(envName, workspaceId, accessToken, expiresAt);
    clearPending();
    process.stderr.write(`Authenticated! Workspace ${workspaceId} saved for env=${envName}.\n`);
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
    const confirmed = await pollUntilConfirmed(envName, pending.sessionId, pending.verificationCode);
    const workspaceId = confirmed.workspaceId || confirmed.workspace_id;
    const accessToken = confirmed.accessToken || confirmed.access_token;
    const expiresAt = confirmed.expiresAt || confirmed.expires_at || null;
    auth.saveWorkspaceToken(envName, workspaceId, accessToken, expiresAt);
    clearPending();
    process.stderr.write(`Authenticated! Workspace ${workspaceId} saved for env=${envName}.\n`);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { runLogin, runLoginPoll };
