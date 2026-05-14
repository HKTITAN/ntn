'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const C = require('../config');
const { publicRequest } = require('../http');
const { printJson, die } = require('../output');

async function readStdin() {
  if (process.stdin.isTTY) return null;
  return await new Promise((resolve, reject) => {
    let b = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => b += d);
    process.stdin.on('end', () => resolve(b));
    process.stdin.on('error', reject);
  });
}

function editorPrompt() {
  const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vi');
  const tmp = path.join(os.tmpdir(), `ntn-page-${Date.now()}.md`);
  fs.writeFileSync(tmp, '');
  const r = spawnSync(editor, [tmp], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error || r.status !== 0) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    die(`Editor '${editor}' exited with an error.`);
  }
  const txt = fs.readFileSync(tmp, 'utf8');
  try { fs.unlinkSync(tmp); } catch (_) {}
  return txt;
}

function parseParent(parentArg) {
  // Accept: 'page:<id>', 'database:<id>', 'data-source:<id>', or raw UUID (defaults to page).
  if (!parentArg) return null;
  const m = parentArg.match(/^(page|database|data-source|data_source|workspace):(.+)$/);
  if (m) {
    const kind = m[1];
    const id = m[2];
    if (kind === 'page') return { page_id: id };
    if (kind === 'database') return { database_id: id };
    if (kind === 'data-source' || kind === 'data_source') return { data_source_id: id };
    if (kind === 'workspace') return { workspace: true };
  }
  return { page_id: parentArg };
}

function markdownToBlocks(md) {
  // Minimal Markdown -> Notion blocks converter (paragraphs and headings).
  if (!md) return [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: para.join('\n') } }] },
      });
      para = [];
    }
  };
  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const t = `heading_${level}`;
      blocks.push({
        object: 'block',
        type: t,
        [t]: { rich_text: [{ type: 'text', text: { content: h[2] } }] },
      });
    } else if (line.trim() === '') {
      flushPara();
    } else {
      para.push(line);
    }
  }
  flushPara();
  return blocks;
}

async function runPages(action, id, opts) {
  const env = C.getEnv(opts.env);
  if (action === 'get') {
    if (!id) die('Missing <page-id>.');
    try {
      const res = await publicRequest({ method: 'GET', endpoint: `v1/pages/${id}`, envName: env });
      if (opts.json) return printJson(res);
      // Try to also fetch children as a 'markdown-ish' rendering.
      const children = await publicRequest({ method: 'GET', endpoint: `v1/blocks/${id}/children`, envName: env, query: { page_size: 100 } });
      printJson({ page: res, children: children.results });
    } catch (e) { die(e.message); }
  } else if (action === 'create') {
    const parent = parseParent(opts.parent);
    if (!parent) die("Missing --parent (e.g. 'page:<uuid>' or 'data-source:<uuid>').");
    let content = opts.content;
    if (content === undefined) {
      const piped = await readStdin();
      if (piped) content = piped;
      else if (!process.stdin.isTTY) content = '';
      else content = editorPrompt();
    }
    const body = { parent, properties: {} };
    if (parent.page_id || parent.workspace) {
      // Page parent: title at root (private title default if not provided)
      body.properties = {
        title: { title: [{ type: 'text', text: { content: opts.title || 'Untitled' } }] },
      };
    } else {
      // Database/data-source parent: title goes in 'title' property (best effort)
      body.properties = {
        title: { title: [{ type: 'text', text: { content: opts.title || 'Untitled' } }] },
      };
    }
    if (content) body.children = markdownToBlocks(content);
    try {
      const res = await publicRequest({ method: 'POST', endpoint: 'v1/pages', body, envName: env });
      printJson(res);
    } catch (e) { die(e.message); }
  } else if (action === 'update') {
    if (!id) die('Missing <page-id>.');
    const patch = {};
    if (opts.archived !== undefined) patch.archived = !!opts.archived;
    if (opts.title) patch.properties = { title: { title: [{ type: 'text', text: { content: opts.title } }] } };
    try {
      const res = await publicRequest({ method: 'PATCH', endpoint: `v1/pages/${id}`, body: patch, envName: env });
      if (opts.content !== undefined) {
        const children = markdownToBlocks(opts.content);
        if (opts.replaceContent) {
          // Fetch & delete existing children
          const existing = await publicRequest({ method: 'GET', endpoint: `v1/blocks/${id}/children`, envName: env });
          for (const b of (existing.results || [])) {
            await publicRequest({ method: 'DELETE', endpoint: `v1/blocks/${b.id}`, envName: env });
          }
        }
        if (children.length) {
          await publicRequest({ method: 'PATCH', endpoint: `v1/blocks/${id}/children`, body: { children }, envName: env });
        }
      }
      printJson(res);
    } catch (e) { die(e.message); }
  } else if (action === 'trash') {
    if (!id) die('Missing <page-id>.');
    try {
      const res = await publicRequest({ method: 'PATCH', endpoint: `v1/pages/${id}`, body: { archived: true }, envName: env });
      process.stderr.write('Page trashed.\n');
      if (opts.json) printJson(res);
    } catch (e) { die(e.message); }
  } else {
    die(`Unknown pages action '${action}'. Use: get, create, update, trash.`);
  }
}

module.exports = { runPages };
