'use strict';

const C = require('./config');
const auth = require('./auth');

function buildUrl(base, endpoint, query) {
  let url = endpoint.startsWith('http')
    ? endpoint
    : `${base.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  if (query && Object.keys(query).length) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) v.forEach(x => usp.append(k, String(x)));
      else usp.append(k, String(v));
    }
    url += (url.includes('?') ? '&' : '?') + usp.toString();
  }
  return url;
}

async function publicRequest({ method = 'GET', endpoint, body, headers = {}, query, envName, raw = false }) {
  envName = envName || C.getEnv();
  const base = C.apiBaseUrl(envName);
  const token = auth.getApiToken();
  if (!token) {
    throw new Error(
      "Not authenticated for the Notion public API.\n" +
      "Set NOTION_API_TOKEN (an integration token from https://www.notion.so/profile/integrations),\n" +
      "or save one via: ntn config set-token <secret_...>"
    );
  }
  const url = buildUrl(base, endpoint, query);
  const h = {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': process.env.NOTION_API_VERSION || C.NOTION_VERSION,
    'User-Agent': `ntn-node/${require('../package.json').version}`,
    ...headers,
  };
  let payload = body;
  if (body && !(body instanceof Buffer) && typeof body !== 'string') {
    h['Content-Type'] = h['Content-Type'] || 'application/json';
    payload = JSON.stringify(body);
  }
  if (process.env.NTN_VERBOSE) {
    console.error(`> ${method} ${url}`);
    if (payload) console.error('> body:', typeof payload === 'string' ? payload.slice(0, 500) : '[binary]');
  }
  const res = await fetch(url, { method, headers: h, body: payload });
  const text = await res.text();
  if (raw) return { ok: res.ok, status: res.status, text, headers: res.headers };
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) {
    const e = new Error(`API ${res.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
    e.status = res.status;
    e.body = parsed;
    throw e;
  }
  return parsed;
}

async function workersRequest({ action, body = {}, envName, workspaceId, headers = {} }) {
  envName = envName || C.getEnv();
  const base = C.baseUrl(envName);
  const t = auth.getWorkspaceToken(envName, workspaceId);
  if (!t) {
    throw new Error("Not authenticated. Run 'ntn login' to start a workspace session.");
  }
  const url = `${base.replace(/\/$/, '')}/api/v3/workers${action}`;
  // Notion's private /api/v3 endpoints traditionally authenticate via the
  // token_v2 cookie. Send both forms (Cookie + Bearer) so we work against
  // either flavor of the workers backend.
  const h = {
    'Cookie': `token_v2=${t.token}`,
    'Authorization': `Bearer ${t.token}`,
    'Content-Type': 'application/json',
    'User-Agent': `ntn-node/${require('../package.json').version}`,
    'x-notion-space-id': t.spaceId,
    ...headers,
  };
  if (process.env.NTN_VERBOSE) {
    console.error(`> POST ${url}`);
    console.error('> body:', JSON.stringify(body).slice(0, 500));
  }
  const res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) {
    const e = new Error(`Workers ${action} ${res.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
    e.status = res.status;
    e.body = parsed;
    throw e;
  }
  return parsed;
}

// Unauthenticated workers request — used by login flow.
async function workersUnauthRequest({ action, body = {}, envName, headers = {} }) {
  envName = envName || C.getEnv();
  const base = C.baseUrl(envName);
  const url = `${base.replace(/\/$/, '')}/api/v3/workers${action}`;
  const h = {
    'Content-Type': 'application/json',
    'User-Agent': `ntn-node/${require('../package.json').version}`,
    ...headers,
  };
  const res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) {
    const e = new Error(`Workers ${action} ${res.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
    e.status = res.status;
    e.body = parsed;
    throw e;
  }
  return parsed;
}

module.exports = { publicRequest, workersRequest, workersUnauthRequest, buildUrl };
