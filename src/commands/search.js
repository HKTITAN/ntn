'use strict';

const C = require('../config');
const { publicRequest } = require('../http');
const { printJson, die } = require('../output');

async function runSearch(query, opts) {
  const body = {};
  if (query) body.query = query;
  if (opts.filter) {
    try { body.filter = JSON.parse(opts.filter); }
    catch (e) { die(`Invalid JSON in --filter: ${e.message}`); }
  }
  if (opts.sort) {
    try { body.sort = JSON.parse(opts.sort); }
    catch (e) { die(`Invalid JSON in --sort: ${e.message}`); }
  }
  if (opts.startCursor) body.start_cursor = opts.startCursor;
  if (opts.limit) body.page_size = parseInt(opts.limit, 10);
  try {
    const res = await publicRequest({
      method: 'POST',
      endpoint: 'v1/search',
      body,
      envName: C.getEnv(opts.env),
    });
    printJson(res);
  } catch (e) { die(e.message); }
}

module.exports = { runSearch };
