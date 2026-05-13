const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function getNotionDir() {
  return process.env.NOTION_HOME || path.join(os.homedir(), '.notion');
}

function getAuthToken() {
  if (process.env.NOTION_API_TOKEN) {
    return process.env.NOTION_API_TOKEN;
  }
  
  const authFile = path.join(getNotionDir(), 'auth.json');
  if (fs.existsSync(authFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(authFile, 'utf8'));
      if (data.token) return data.token;
    } catch(err) {
      // Ignore
    }
  }
  
  console.error("Error: Not authenticated. Set NOTION_API_TOKEN or run 'ntn login'.");
  process.exitCode = 1;
  return null;
}

function getWorkspaces() {
  const wsFile = path.join(getNotionDir(), 'workspaces.json');
  if (fs.existsSync(wsFile)) {
    try {
      return JSON.parse(fs.readFileSync(wsFile, 'utf8'));
    } catch(err) {
      // Ignore
    }
  }
  return {};
}

function parseInlineArgs(args) {
    // E.g., parent[page_id]=abc123 or archived:=true
    let body = {};
    for (const arg of args) {
        let isNative = false;
        let match = arg.match(/^(.+?):=?(.+)$/);
        
        if (!match) continue; // Skip non-assignments
        
        let [_, pathStr, value] = match;
        
        if (arg.includes(':=')) {
           // parse as JSON if possible (native true/false/number)
           try {
             value = JSON.parse(value);
           } catch(e) {}
        }
        
        // rudimentary path splitting 'parent[page_id]' -> ['parent', 'page_id']
        let keys = pathStr.split(/\[|\]\./).map(k => k.replace(/\]$/, ''));
        
        let curr = body;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!curr[keys[i]]) curr[keys[i]] = {};
            curr = curr[keys[i]];
        }
        curr[keys[keys.length - 1]] = value;
    }
    return body;
}

module.exports = {
  getNotionDir,
  getAuthToken,
  getWorkspaces,
  parseInlineArgs
};
