'use strict';

const C = require('../config');
const { publicRequest } = require('../http');
const { printJson, die } = require('../output');

async function runDatasources(action, id, opts) {
  const env = C.getEnv(opts.env);
  if (action === 'query') {
    if (!id) die('Missing <data-source-id>.');
    const body = {};
    if (opts.filter) {
      try { body.filter = JSON.parse(opts.filter); }
      catch (e) { die(`Invalid JSON in --filter: ${e.message}`); }
    }
    if (opts.sorts) {
      try { body.sorts = JSON.parse(opts.sorts); }
      catch (e) { die(`Invalid JSON in --sorts: ${e.message}`); }
    }
    if (opts.startCursor) body.start_cursor = opts.startCursor;
    if (opts.limit) body.page_size = parseInt(opts.limit, 10);
    try {
      const res = await publicRequest({
        method: 'POST',
        endpoint: `v1/data_sources/${id}/query`,
        body,
        envName: env,
      });
      printJson(res);
    } catch (e) { die(e.message); }
  } else if (action === 'resolve') {
    if (!id) die('Missing <database-id>.');
    try {
      const res = await publicRequest({
        method: 'GET',
        endpoint: `v1/databases/${id}`,
        envName: env,
      });
      printJson(res);
    } catch (e) { die(e.message); }
  } else if (action === 'get') {
    if (!id) die('Missing <data-source-id>.');
    try {
      const res = await publicRequest({
        method: 'GET',
        endpoint: `v1/data_sources/${id}`,
        envName: env,
      });
      printJson(res);
    } catch (e) { die(e.message); }
  } else {
    die(`Unknown datasources action '${action}'. Use: query, resolve, get.`);
  }
}

module.exports = { runDatasources };
