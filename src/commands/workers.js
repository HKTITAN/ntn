'use strict';

const fs = require('node:fs');
const C = require('../config');
const { workersRequest } = require('../http');
const auth = require('../auth');
const { printJson, printTable, die } = require('../output');

function readWorkersConfig() {
  return C.readJson(C.workersConfigFile(), null);
}

function writeWorkersConfig(data) {
  C.writeJson(C.workersConfigFile(), data);
}

function resolveWorkerId(argId) {
  if (argId) return argId;
  const wc = readWorkersConfig();
  if (wc && wc.workerId) return wc.workerId;
  die('No worker ID found. Provide a worker ID or run from a directory with workers.json.');
}

async function runWorkers(sub, args, opts) {
  const env = C.getEnv(opts.env);
  // sub-commands
  if (sub === 'list' || sub === undefined) {
    const res = await workersRequest({ action: 'ListWorkers', body: {}, envName: env });
    if (opts.json) return printJson(res);
    const rows = (res.workers || []).map(w => ({ id: w.id, name: w.name, status: w.status || w.state || '' }));
    if (!rows.length) { process.stderr.write('No workers found in this workspace.\n'); return; }
    printTable(rows, [
      { key: 'id', header: 'ID' }, { key: 'name', header: 'NAME' }, { key: 'status', header: 'STATUS' }
    ], { plain: !!opts.plain });
    return;
  }
  if (sub === 'get') {
    const workerId = resolveWorkerId(args[0]);
    const res = await workersRequest({ action: 'GetWorker', body: { workerId }, envName: env });
    printJson(res);
    return;
  }
  if (sub === 'delete') {
    const workerId = resolveWorkerId(args[0]);
    if (!opts.yes) die('Pass --yes to confirm deletion.');
    const res = await workersRequest({ action: 'DeleteWorker', body: { workerId }, envName: env });
    process.stderr.write('Worker deleted.\n');
    if (opts.json) printJson(res);
    return;
  }
  if (sub === 'usage') {
    const workerId = resolveWorkerId(args[0]);
    const res = await workersRequest({ action: 'GetWorkerUsage', body: { workerId }, envName: env });
    printJson(res);
    return;
  }
  if (sub === 'capabilities') {
    const cmd = args[0] || 'list';
    if (cmd === 'list') {
      const workerId = resolveWorkerId(args[1]);
      const res = await workersRequest({ action: 'ListCapabilities', body: { workerId }, envName: env });
      printJson(res);
      return;
    }
    die(`Unknown 'workers capabilities' subcommand '${cmd}'. Use: list.`);
  }
  if (sub === 'runs') {
    const cmd = args[0] || 'list';
    if (cmd === 'list') {
      const workerId = resolveWorkerId(args[1]);
      const res = await workersRequest({ action: 'ListRunsForWorker', body: { workerId, limit: opts.limit || 50 }, envName: env });
      if (opts.json) return printJson(res);
      const rows = (res.runs || []).map(r => ({ id: r.id, exitCode: r.exitCode, startedAt: r.startedAt }));
      printTable(rows, [
        { key: 'id', header: 'RUN ID' }, { key: 'exitCode', header: 'EXIT CODE' }, { key: 'startedAt', header: 'STARTED AT' }
      ], { plain: !!opts.plain });
      return;
    }
    if (cmd === 'logs') {
      const runId = args[1] || die('Missing <run-id>.');
      const res = await workersRequest({ action: 'GetRunLogs', body: { runId }, envName: env });
      printJson(res);
      return;
    }
    die(`Unknown 'workers runs' subcommand '${cmd}'. Use: list, logs.`);
  }
  if (sub === 'env') {
    const cmd = args[0] || 'list';
    const workerId = resolveWorkerId(args[1]);
    if (cmd === 'list') {
      const res = await workersRequest({ action: 'ListSecrets', body: { workerId }, envName: env });
      printJson(res);
      return;
    }
    if (cmd === 'pull') {
      const res = await workersRequest({ action: 'PullEnv', body: { workerId }, envName: env });
      const target = opts.file || '.env';
      if (opts.noFile) { printJson(res); return; }
      const lines = (res.env || []).map(e => `${e.key}=${JSON.stringify(e.value)}`).join('\n') + '\n';
      fs.writeFileSync(target, lines);
      process.stderr.write(`Wrote ${target}\n`);
      return;
    }
    if (cmd === 'set') {
      const kv = args[2];
      const m = kv && kv.match(/^([^=]+)=(.*)$/);
      if (!m) die("Usage: ntn workers env set <worker-id> KEY=VALUE");
      const res = await workersRequest({ action: 'UpsertSecrets', body: { workerId, secrets: { [m[1]]: m[2] } }, envName: env });
      printJson(res);
      return;
    }
    if (cmd === 'unset') {
      const key = args[2] || die('Usage: ntn workers env unset <worker-id> KEY');
      const res = await workersRequest({ action: 'DeleteSecret', body: { workerId, key }, envName: env });
      printJson(res);
      return;
    }
    if (cmd === 'push') {
      const file = args[2] || '.env';
      if (!fs.existsSync(file)) die(`Env file '${file}' not found.`);
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#'));
      const secrets = {};
      for (const line of lines) {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (!m) continue;
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        secrets[m[1]] = v;
      }
      const res = await workersRequest({ action: 'UpsertSecrets', body: { workerId, secrets }, envName: env });
      printJson(res);
      return;
    }
    die(`Unknown 'workers env' subcommand '${cmd}'. Use: list, set, unset, pull, push.`);
  }
  if (sub === 'sync') {
    const cmd = args[0];
    const workerId = resolveWorkerId(args[1]);
    if (cmd === 'status') {
      const res = await workersRequest({ action: 'GetSyncStatus', body: { workerId }, envName: env });
      printJson(res);
      return;
    }
    if (cmd === 'pause') return printJson(await workersRequest({ action: 'PauseSync', body: { workerId }, envName: env }));
    if (cmd === 'resume') return printJson(await workersRequest({ action: 'ResumeSync', body: { workerId }, envName: env }));
    if (cmd === 'trigger') {
      const key = args[2] || die('Missing <capability-key>.');
      const res = await workersRequest({ action: 'SyncForceRun', body: { workerId, capabilityKey: key }, envName: env });
      printJson(res);
      return;
    }
    if (cmd === 'state') {
      const stateCmd = args[2];
      const key = args[3];
      if (stateCmd === 'get') return printJson(await workersRequest({ action: 'SyncStateGet', body: { workerId, capabilityKey: key }, envName: env }));
      if (stateCmd === 'reset') {
        if (!opts.yes) die('Pass --yes to confirm reset.');
        return printJson(await workersRequest({ action: 'SyncStateReset', body: { workerId, capabilityKey: key }, envName: env }));
      }
      die(`Unknown 'workers sync state' subcommand '${stateCmd}'.`);
    }
    die(`Unknown 'workers sync' subcommand '${cmd}'. Use: status, pause, resume, trigger, state.`);
  }
  if (sub === 'webhooks') {
    const cmd = args[0] || 'list';
    if (cmd === 'list') {
      const workerId = resolveWorkerId(args[1]);
      const res = await workersRequest({ action: 'ListWebhooks', body: { workerId }, envName: env });
      printJson(res);
      return;
    }
    die(`Unknown 'workers webhooks' subcommand '${cmd}'. Use: list.`);
  }
  if (sub === 'oauth') {
    const cmd = args[0];
    const workerId = resolveWorkerId(args[1]);
    const key = args[2];
    if (cmd === 'start') {
      const res = await workersRequest({ action: 'StartOauth', body: { workerId, capabilityKey: key }, envName: env });
      printJson(res);
      return;
    }
    if (cmd === 'token') {
      const res = await workersRequest({ action: 'GetOauthToken', body: { workerId, capabilityKey: key }, envName: env });
      if (opts.plain && res.accessToken) { process.stdout.write(res.accessToken + '\n'); return; }
      printJson(res);
      return;
    }
    if (cmd === 'show-redirect-url') {
      const base = C.baseUrl(env);
      process.stdout.write(`${base}/workers/oauth/callback\n`);
      return;
    }
    die(`Unknown 'workers oauth' subcommand '${cmd}'. Use: start, token, show-redirect-url.`);
  }
  if (sub === 'new') {
    const name = args[0] || die('Missing worker name.');
    const res = await workersRequest({ action: 'CreateWorker', body: { name }, envName: env });
    const workerId = res.id || (res.worker && res.worker.id);
    if (workerId) writeWorkersConfig({ workerId, environment: env, name });
    process.stderr.write('Worker created.\n');
    printJson(res);
    return;
  }
  if (sub === 'deploy') {
    die(
      "'ntn workers deploy' is not implemented in this port.\n" +
      "Notion's deploy flow uses a multi-step bundle/upload/build pipeline that ships only\n" +
      "with the upstream Rust binary. Use the official 'ntn' (macOS/Linux) for deployment,\n" +
      "or use 'ntn workers new <name>' here to create a worker and deploy from another machine."
    );
  }
  if (sub === 'exec') {
    // Best-effort: invoke a function on a worker.
    const workerId = resolveWorkerId(args[0]);
    const fnName = args[1] || die('Missing <function-name>.');
    let funcArgs = {};
    if (opts.data) {
      try { funcArgs = JSON.parse(opts.data); }
      catch (e) { die(`Invalid JSON in --data: ${e.message}`); }
    }
    const res = await workersRequest({ action: 'CallFunction', body: { workerId, functionName: fnName, functionArgs: funcArgs }, envName: env });
    printJson(res);
    return;
  }
  if (sub === 'tui') {
    die('TUI mode is not available in the Node.js port. Use `ntn workers list` and related subcommands.');
  }
  die(`Unknown 'workers' subcommand '${sub}'. Use: list, get, new, deploy, delete, runs, env, capabilities, webhooks, sync, oauth, usage, exec.`);
}

module.exports = { runWorkers };
