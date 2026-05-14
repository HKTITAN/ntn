'use strict';

const fs = require('node:fs');
const path = require('node:path');
const C = require('../config');
const { publicRequest } = require('../http');
const { printJson, die } = require('../output');

const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20 MB

function readAllStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);
  });
}

function guessContentType(name) {
  const ext = (name || '').toLowerCase().split('.').pop();
  return {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
    json: 'application/json', mp4: 'video/mp4', mp3: 'audio/mpeg',
    csv: 'text/csv', html: 'text/html', svg: 'image/svg+xml', webp: 'image/webp',
  }[ext] || 'application/octet-stream';
}

async function uploadSinglePart(uploadUrl, buf, contentType, filename) {
  // multipart/form-data with file field
  const boundary = '----ntn' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const safeName = String(filename || 'upload').replace(/["\r\n]/g, '_');
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, buf, tail]);
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${require('../auth').getApiToken()}`,
      'Notion-Version': C.NOTION_VERSION,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload send failed ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch (_) { return text; }
}

async function runFiles(action, id, opts) {
  const env = C.getEnv(opts.env);
  if (action === 'list') {
    try {
      const res = await publicRequest({
        method: 'GET',
        endpoint: 'v1/file_uploads',
        envName: env,
        query: opts.limit ? { page_size: opts.limit } : undefined,
      });
      printJson(res);
    } catch (e) { die(e.message); }
    return;
  }
  if (action === 'get') {
    if (!id) die('Missing <upload-id>.');
    try {
      const res = await publicRequest({ method: 'GET', endpoint: `v1/file_uploads/${id}`, envName: env });
      printJson(res);
    } catch (e) { die(e.message); }
    return;
  }
  if (action === 'create') {
    if (opts.externalUrl) {
      const body = { mode: 'external_url', external_url: opts.externalUrl };
      if (opts.filename) body.filename = opts.filename;
      if (opts.contentType) body.content_type = opts.contentType;
      try {
        const res = await publicRequest({ method: 'POST', endpoint: 'v1/file_uploads', body, envName: env });
        printJson(res);
      } catch (e) { die(e.message); }
      return;
    }
    let data;
    let filename = opts.filename;
    let contentType = opts.contentType;
    if (opts.file) {
      data = fs.readFileSync(opts.file);
      if (!filename) filename = path.basename(opts.file);
      if (!contentType) contentType = guessContentType(filename);
    } else {
      if (process.stdin.isTTY) die('No file. Pass --file <path>, --external-url <url>, or pipe data via stdin.');
      data = await readAllStdin();
      if (!filename) filename = 'upload';
      if (!contentType) contentType = 'application/octet-stream';
    }
    // For now: single-part upload (smaller bodies). Multipart could be added.
    try {
      const initBody = { mode: 'single_part', filename, content_type: contentType };
      const init = await publicRequest({ method: 'POST', endpoint: 'v1/file_uploads', body: initBody, envName: env });
      let initObj = init;
      if (!initObj.upload_url) {
        // Server-side may have a different mode key; fall back to no-mode init
        initObj = await publicRequest({ method: 'POST', endpoint: 'v1/file_uploads', body: { filename, content_type: contentType }, envName: env });
      }
      if (!initObj.upload_url) die('File upload init did not return an upload_url.');
      await uploadSinglePart(initObj.upload_url, data, contentType, filename);
      // Re-fetch the upload to confirm completion status
      try {
        const finalState = await publicRequest({ method: 'GET', endpoint: `v1/file_uploads/${initObj.id}`, envName: env });
        printJson(finalState);
      } catch (_) {
        printJson(initObj);
      }
    } catch (e) { die(e.message); }
    return;
  }
  if (action === 'complete') {
    if (!id) die('Missing <upload-id>.');
    try {
      const res = await publicRequest({ method: 'POST', endpoint: `v1/file_uploads/${id}/complete`, body: {}, envName: env });
      printJson(res);
    } catch (e) { die(e.message); }
    return;
  }
  die(`Unknown files action '${action}'. Use: create, get, list, complete.`);
}

module.exports = { runFiles };
