'use strict';

const fs = require('node:fs');
const C = require('./config');

// Auth file shape:
// {
//   "token": "secret_xxx",                      // legacy single-token (public API integration token)
//   "environments": {
//     "prod": {
//       "defaultWorkspaceId": "...",
//       "tokens": { "<workspaceId>": { "accessToken": "...", "expiresAt": "..." } }
//     }
//   }
// }

function readAuth() {
  return C.readJson(C.authFile(), {});
}

function writeAuth(data) {
  C.writeJson(C.authFile(), data);
}

function getApiToken(envName) {
  if (process.env.NOTION_API_TOKEN) return process.env.NOTION_API_TOKEN;
  const a = readAuth();
  if (a.token) return a.token; // legacy single-token shape
  // Fall back to the saved workspace token from `ntn login` for the current env.
  if (envName) {
    const env = a.environments && a.environments[envName];
    if (env) {
      const spaceId = env.defaultSpaceId || env.defaultWorkspaceId;
      const t = spaceId && env.tokens && env.tokens[spaceId];
      if (t && (t.token || t.accessToken)) return t.token || t.accessToken;
    }
  }
  return null;
}

function getWorkspaceToken(envName, spaceId) {
  const a = readAuth();
  const env = a.environments && a.environments[envName];
  if (!env) return null;
  if (!spaceId) spaceId = env.defaultSpaceId || env.defaultWorkspaceId;
  if (!spaceId) return null;
  const t = env.tokens && env.tokens[spaceId];
  if (!t) return null;
  return { spaceId, token: t.token || t.accessToken, spaceName: t.spaceName || '', expiresAt: t.expiresAt };
}

function saveWorkspaceToken(envName, spaceId, token, expiresAt, spaceName) {
  const a = readAuth();
  if (!a.environments) a.environments = {};
  if (!a.environments[envName]) a.environments[envName] = { tokens: {} };
  if (!a.environments[envName].tokens) a.environments[envName].tokens = {};
  a.environments[envName].tokens[spaceId] = { token, expiresAt: expiresAt || null, spaceName: spaceName || '' };
  if (!a.environments[envName].defaultSpaceId) {
    a.environments[envName].defaultSpaceId = spaceId;
  }
  writeAuth(a);
}

function setDefaultWorkspace(envName, spaceId) {
  const a = readAuth();
  if (!a.environments) a.environments = {};
  if (!a.environments[envName]) a.environments[envName] = { tokens: {} };
  a.environments[envName].defaultSpaceId = spaceId;
  writeAuth(a);
}

function clearAuth() {
  try { fs.unlinkSync(C.authFile()); } catch (_) {}
}

function logoutAll() {
  clearAuth();
}

function listWorkspaces(envName) {
  const a = readAuth();
  const env = a.environments && a.environments[envName];
  if (!env || !env.tokens) return [];
  return Object.keys(env.tokens).map(id => ({
    spaceId: id,
    spaceName: env.tokens[id].spaceName || '',
    expiresAt: env.tokens[id].expiresAt,
    isDefault: (env.defaultSpaceId || env.defaultWorkspaceId) === id,
  }));
}

module.exports = {
  readAuth,
  writeAuth,
  getApiToken,
  getWorkspaceToken,
  saveWorkspaceToken,
  setDefaultWorkspace,
  clearAuth,
  logoutAll,
  listWorkspaces,
};
