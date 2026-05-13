const { getAuthToken } = require('../utils');

const API_BASE = 'https://api.notion.com';
const API_VERSION = '2022-06-28';

async function request(method, endpoint, body) {
  const token = getAuthToken();
  if (!token) return;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}/${endpoint.replace(/^\//, '')}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': API_VERSION,
    }
  };

  if (body) {
    if (body instanceof Buffer || (typeof body === 'string' && body.includes('multipart/form-data'))) {
        // Handle multipart / raw (for files)
        options.body = body;
    } else {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    let errBody = await res.text();
    try {
        errBody = JSON.parse(errBody);
    } catch(e) {}
    console.error(`API Error ${res.status}:`, errBody);
    process.exitCode = 1;
    return;
  }
  
  return await res.json();
}

async function apiCmd(endpoint, options, rawArgs) {
  let method = (options.method || 'GET').toUpperCase();
  const { parseInlineArgs } = require('../utils');
  const body = parseInlineArgs(rawArgs);
  
  if (Object.keys(body).length > 0 && method === 'GET') {
      method = 'POST';
  }
  
  const result = await request(method, endpoint, Object.keys(body).length > 0 ? body : undefined);
  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = { request, apiCmd };
