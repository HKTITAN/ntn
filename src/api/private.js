const { getAuthToken, getWorkspaces } = require('../utils');

const PRIVATE_API_BASE = 'https://www.notion.so/api/v3';

async function privateRequest(method, endpoint, body = {}) {
  const token = getAuthToken(); // Often Notion private APIs require token_v2, meaning the same token if unified, or an injected cookie.
  if (!token) return;
  // We'll pass it as token_v2 cookie as is typical for Notion private API
  const url = `${PRIVATE_API_BASE}/${endpoint.replace(/^\//, '')}`;
  
  const options = {
    method,
    headers: {
      'Cookie': `token_v2=${token};`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };

  const res = await fetch(url, options);
  if (!res.ok) {
    let errBody = await res.text();
    try {
        errBody = JSON.parse(errBody);
    } catch(e) {}
    console.error(`Private API Error ${res.status}:`, errBody);
    process.exitCode = 1;
    return;
  }
  
  return await res.json();
}

async function workersCmd(cmd, args) {
  // Pass through structure for workers
  // To avoid failing, we blindly passthrough what we can.
  console.log(`Executing worker command: ${cmd} with args:`, args);
  // Example for deploy (stubbed as generic)
  const result = await privateRequest('POST', 'workersDeploy', { command: cmd, args });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { privateRequest, workersCmd };
