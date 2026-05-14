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
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    const fence = line.match(/^```(\w*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const t = `heading_${level}`;
      blocks.push({ object: 'block', type: t, [t]: { rich_text: [{ type: 'text', text: { content: h[2] } }] } });
    } else if (bullet) {
      flushPara();
      blocks.push({
        object: 'block', type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: bullet[1] } }] },
      });
    } else if (numbered) {
      flushPara();
      blocks.push({
        object: 'block', type: 'numbered_list_item',
        numbered_list_item: { rich_text: [{ type: 'text', text: { content: numbered[1] } }] },
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

function richTextToString(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map(rt => rt.plain_text || (rt.text && rt.text.content) || '').join('');
}

function blockToMarkdown(b) {
  const t = b.type;
  const o = b[t] || {};
  const txt = () => richTextToString(o.rich_text || o.title || []);
  switch (t) {
    case 'paragraph':         return txt();
    case 'heading_1':         return `# ${txt()}`;
    case 'heading_2':         return `## ${txt()}`;
    case 'heading_3':         return `### ${txt()}`;
    case 'bulleted_list_item':return `- ${txt()}`;
    case 'numbered_list_item':return `1. ${txt()}`;
    case 'to_do':             return `- [${o.checked ? 'x' : ' '}] ${txt()}`;
    case 'quote':             return `> ${txt()}`;
    case 'code':              return '```' + (o.language || '') + '\n' + txt() + '\n```';
    case 'divider':           return '---';
    case 'callout':           return `> ${txt()}`;
    case 'toggle':            return `<details><summary>${txt()}</summary></details>`;
    case 'child_page':        return `[${o.title || 'Untitled'}]`;
    case 'image':             return `![](${o.external ? o.external.url : (o.file ? o.file.url : '')})`;
    case 'bookmark':          return `[bookmark](${o.url || ''})`;
    case 'equation':          return `$$${o.expression || ''}$$`;
    case 'unsupported':       return '<!-- unsupported block -->';
    default:                  return `<!-- ${t} -->`;
  }
}

async function renderMarkdown(pageId, env) {
  let pageTitle = '';
  try {
    const page = await publicRequest({ method: 'GET', endpoint: `v1/pages/${pageId}`, envName: env });
    const titleProp = page.properties && (page.properties.title || page.properties.Name || page.properties.name);
    if (titleProp && titleProp.title) pageTitle = richTextToString(titleProp.title);
  } catch (_) {}
  const out = [];
  if (pageTitle) out.push(`# ${pageTitle}`, '');
  let cursor;
  let unknown = [];
  do {
    const q = { page_size: 100 };
    if (cursor) q.start_cursor = cursor;
    const res = await publicRequest({ method: 'GET', endpoint: `v1/blocks/${pageId}/children`, envName: env, query: q });
    for (const b of (res.results || [])) {
      const md = blockToMarkdown(b);
      out.push(md);
      if (b.type === 'unsupported' || md.startsWith('<!-- ')) unknown.push(b.id);
    }
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  process.stdout.write(out.join('\n') + '\n');
  if (unknown.length) {
    process.stderr.write(`note: ${unknown.length} block(s) could not be rendered. Use --json to inspect unknown_block_ids.\n`);
  }
}

async function runPages(action, id, opts) {
  const env = C.getEnv(opts.env);
  if (action === 'get') {
    if (!id) die('Missing <page-id>.');
    if (opts.json) {
      try {
        const res = await publicRequest({ method: 'GET', endpoint: `v1/pages/${id}`, envName: env });
        printJson(res);
      } catch (e) { die(e.message); }
    } else {
      try { await renderMarkdown(id, env); }
      catch (e) { die(e.message); }
    }
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
    const body = {
      parent,
      properties: { title: { title: [{ type: 'text', text: { content: opts.title || 'Untitled' } }] } },
    };
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
      let res;
      if (Object.keys(patch).length) {
        res = await publicRequest({ method: 'PATCH', endpoint: `v1/pages/${id}`, body: patch, envName: env });
      } else {
        res = await publicRequest({ method: 'GET', endpoint: `v1/pages/${id}`, envName: env });
      }
      if (opts.content !== undefined) {
        const children = markdownToBlocks(opts.content);
        if (opts.replaceContent) {
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
