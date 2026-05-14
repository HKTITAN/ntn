'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ENVS = {
  local: { base: 'http://localhost:3000', api: 'https://api-dev.notion.com' },
  dev:   { base: 'https://dev.notion.so', api: 'https://api-dev.notion.com' },
  stg:   { base: 'https://stg.notion.so', api: 'https://api-stg.notion.com' },
  prod:  { base: 'https://www.notion.so', api: 'https://api.notion.com' },
};

const NOTION_VERSION = '2022-06-28';

function getEnv(flag) {
  const e = flag || process.env.NOTION_ENV || 'prod';
  if (!ENVS[e]) throw new Error(`Unknown --env '${e}'. Use local|dev|stg|prod.`);
  return e;
}

function baseUrl(envName) {
  return process.env.NOTION_BASE_URL || ENVS[envName].base;
}

function apiBaseUrl(envName) {
  return process.env.NOTION_API_BASE_URL || ENVS[envName].api;
}

function notionHome() {
  if (process.env.NOTION_HOME) {
    if (!fs.existsSync(process.env.NOTION_HOME)) {
      throw new Error(`NOTION_HOME is set but does not point to an existing directory: ${process.env.NOTION_HOME}`);
    }
    return process.env.NOTION_HOME;
  }
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'notion');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    // Use 'notion-cli' (not 'notion') so we do not collide with the
    // Notion desktop app data dir at %APPDATA%\notion.
    return path.join(appData, 'notion-cli');
  }
  return path.join(os.homedir(), '.config', 'notion');
}

function cacheHome() {
  if (process.env.NOTION_HOME) return path.join(process.env.NOTION_HOME, 'cache');
  if (process.env.XDG_CACHE_HOME) return path.join(process.env.XDG_CACHE_HOME, 'notion');
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, 'notion-cli', 'cache');
  }
  return path.join(os.homedir(), '.cache', 'notion');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  if (process.platform !== 'win32' && /auth\.json|pending-login\.json/.test(file)) {
    try { fs.chmodSync(file, 0o600); } catch (_) {}
  }
}

function configFile() { return path.join(notionHome(), 'config.json'); }
function authFile()   { return path.join(notionHome(), 'auth.json'); }
function workspacesFile() { return path.join(notionHome(), 'workspaces.json'); }
function pendingLoginFile() { return path.join(notionHome(), 'pending-login.json'); }
function workersConfigFile() {
  return process.env.NOTION_WORKERS_CONFIG_FILE || path.join(process.cwd(), 'workers.json');
}
function cacheFile() { return path.join(cacheHome(), 'cache.json'); }
function openapiCacheFile() { return path.join(cacheHome(), 'openapi.json'); }

module.exports = {
  ENVS,
  NOTION_VERSION,
  getEnv,
  baseUrl,
  apiBaseUrl,
  notionHome,
  cacheHome,
  ensureDir,
  readJson,
  writeJson,
  configFile,
  authFile,
  workspacesFile,
  pendingLoginFile,
  workersConfigFile,
  cacheFile,
  openapiCacheFile,
};
