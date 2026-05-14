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

function getApiToken() {
  if (process.env.NOTION_API_TOKEN) return process.env.NOTION_API_TOKEN;
  const a = readAuth();
  if (a.token) return a.token;
  // No public-API integration token configured.
  return null;
}

function getWorkspaceToken(envName, workspaceId) {
  const a = readAuth();
  const env = a.environments && a.environments[envName];
  if (!env) return null;
  if (!workspaceId) workspaceId = env.defaultWorkspaceId;
  if (!workspaceId) return null;
  const t = env.tokens && env.tokens[workspaceId];
  if (!t) return null;
  return { workspaceId, accessToken: t.accessToken, expiresAt: t.expiresAt };
}

function saveWorkspaceToken(envName, workspaceId, accessToken, expiresAt) {
  const a = readAuth();
  if (!a.environments) a.environments = {};
  if (!a.environments[envName]) a.environments[envName] = { tokens: {} };
  if (!a.environments[envName].tokens) a.environments[envName].tokens = {};
  a.environments[envName].tokens[workspaceId] = { accessToken, expiresAt };
  if (!a.environments[envName].defaultWorkspaceId) {
    a.environments[envName].defaultWorkspaceId = workspaceId;
  }
  writeAuth(a);
}

function setDefaultWorkspace(envName, workspaceId) {
  const a = readAuth();
  if (!a.environments) a.environments = {};
  if (!a.environments[envName]) a.environments[envName] = { tokens: {} };
  a.environments[envName].defaultWorkspaceId = workspaceId;
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
    workspaceId: id,
    expiresAt: env.tokens[id].expiresAt,
    isDefault: env.defaultWorkspaceId === id,
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
