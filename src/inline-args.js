'use strict';

// Parse httpie-style inline args.
// Recognized forms:
//   Header:Value        HTTP header
//   name==value         Query parameter
//   path=value          String body field (supports dotted/bracketed paths)
//   path:=jsonvalue     JSON-typed body field
// Anything else returns { unknown: [...] }.
//
// Path expressions:
//   parent[page_id]=abc  -> parent: { page_id: "abc" }
//   filter.value=42      -> filter: { value: "42" }
//   tags[]=a tags[]=b    -> tags: ["a","b"]

function setDeep(target, pathStr, value) {
  // Tokenize: split on '.' and '[' '/']' boundaries
  const tokens = [];
  let buf = '';
  for (let i = 0; i < pathStr.length; i++) {
    const c = pathStr[i];
    if (c === '.') {
      if (buf) { tokens.push({ key: buf, kind: 'obj' }); buf = ''; }
    } else if (c === '[') {
      if (buf) { tokens.push({ key: buf, kind: 'obj' }); buf = ''; }
      let inner = '';
      i++;
      while (i < pathStr.length && pathStr[i] !== ']') { inner += pathStr[i]; i++; }
      if (inner === '') tokens.push({ key: null, kind: 'arrPush' });
      else if (/^\d+$/.test(inner)) tokens.push({ key: parseInt(inner, 10), kind: 'arr' });
      else tokens.push({ key: inner, kind: 'obj' });
    } else {
      buf += c;
    }
  }
  if (buf) tokens.push({ key: buf, kind: 'obj' });

  let cur = target;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isLast = i === tokens.length - 1;
    if (t.kind === 'arrPush') {
      if (!Array.isArray(cur)) throw new Error(`Cannot push into non-array at ${pathStr}`);
      if (isLast) { cur.push(value); return; }
      const next = {};
      cur.push(next);
      cur = next;
    } else if (t.kind === 'arr') {
      if (!Array.isArray(cur)) throw new Error(`Index into non-array at ${pathStr}`);
      if (isLast) { cur[t.key] = value; return; }
      if (cur[t.key] === undefined) {
        cur[t.key] = (tokens[i + 1].kind === 'arr' || tokens[i + 1].kind === 'arrPush') ? [] : {};
      }
      cur = cur[t.key];
    } else {
      if (isLast) { cur[t.key] = value; return; }
      if (cur[t.key] === undefined) {
        cur[t.key] = (tokens[i + 1].kind === 'arr' || tokens[i + 1].kind === 'arrPush') ? [] : {};
      }
      cur = cur[t.key];
    }
  }
}

function parse(args) {
  const headers = {};
  const query = {};
  const body = {};
  const unknown = [];
  let hasBody = false;

  for (const arg of args) {
    let m;
    // Order matters: '==' before '=', ':=' before ':'
    if ((m = arg.match(/^([^=:]+)==(.*)$/))) {
      query[m[1]] = m[2];
    } else if ((m = arg.match(/^([^=:]+):=(.*)$/))) {
      let v;
      try { v = JSON.parse(m[2]); } catch (e) {
        throw new Error(`Failed to parse inline request input: ${arg} (expected JSON after :=)`);
      }
      setDeep(body, m[1], v);
      hasBody = true;
    } else if ((m = arg.match(/^([^=:\s]+):(.+)$/)) && !arg.includes('=')) {
      headers[m[1]] = m[2];
    } else if ((m = arg.match(/^([^=]+)=(.*)$/))) {
      setDeep(body, m[1], m[2]);
      hasBody = true;
    } else {
      unknown.push(arg);
    }
  }
  return { headers, query, body, hasBody, unknown };
}

module.exports = { parse };
