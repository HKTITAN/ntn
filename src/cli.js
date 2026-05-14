'use strict';

const VERSION = require('../package.json').version;

// Lightweight argv parser: collects known flags, leaves positionals.
// Flags recognized:
//   --env <e>, --json, --plain, --verbose, --unsafe-verbose
//   -X/--method, -d/--data, --spec, --docs
//   --filter, --sort, --sorts, --start-cursor, --limit
//   --parent, --content, --title, --archived, --replace-content
//   --external-url, --file, --filename, --content-type
//   --name, --yes, --all, --no-file
//   --workers-config-file, --help/-h, --version/-V

const BOOL_FLAGS = new Set([
  '--json', '--plain', '--verbose', '--unsafe-verbose',
  '--spec', '--docs', '--archived', '--replace-content',
  '--yes', '--all', '--no-file', '--help', '-h',
  '--version', '-V', '--no-git', '--local-build', '--alpha', '--external'
]);

const SHORT_VALUE = { '-X': '--method', '-d': '--data', '-e': '--env' };

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (SHORT_VALUE[a]) a = SHORT_VALUE[a];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let key, val;
      if (eq >= 0) { key = a.slice(0, eq); val = a.slice(eq + 1); }
      else { key = a; val = undefined; }
      if (BOOL_FLAGS.has(key) || val !== undefined) {
        if (val !== undefined) { opts[camel(key)] = val; }
        else { opts[camel(key)] = true; }
      } else {
        // value comes from next argv
        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          opts[camel(key)] = argv[++i];
        } else {
          opts[camel(key)] = true;
        }
      }
    } else if (a.startsWith('-') && a.length > 1 && SHORT_VALUE[a.slice(0, 2)] === undefined) {
      // single-letter unknown; keep as positional-ish
      positional.push(a);
    } else {
      positional.push(a);
    }
  }
  return { positional, opts };
}

function camel(flag) {
  return flag.replace(/^--?/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const HELP = `ntn — Notion CLI (Node port) v${VERSION}

USAGE:
  ntn <command> [args...] [--env local|dev|stg|prod]

AUTH:
  login [poll]                 Browser OAuth login (workers/private API)
  logout [--all]               Forget tokens
  reset --yes                  Remove all CLI data
  doctor                       Diagnostic checks

PUBLIC API:
  api <path> [inputs...]       httpie-style requests
  api ls                       List all OpenAPI endpoints
  api <path> --spec|--docs     Inspect endpoint metadata/docs
  search [query] [--filter] [--sort] [--limit]
  pages get <id> [--json]
  pages create --parent page:<uuid> [--title T] [--content MD]
  pages update <id> [--title T] [--content MD] [--replace-content] [--archived]
  pages trash <id>
  datasources query <id> [--filter] [--limit] [--start-cursor]
  datasources resolve <database-id>
  datasources get <id>
  files create --file <path>|--external-url <url>|<stdin>  [--filename] [--content-type]
  files get <upload-id>
  files list
  files complete <upload-id>

WORKERS (Beta):
  workers list|get|new|deploy|delete|runs|env|capabilities|webhooks|sync|oauth|usage|exec
  tools call <NAME> [--data JSON]

MISC:
  completion <bash|zsh|fish|powershell|elvish>
  update
  --version, --help

INLINE INPUT SYNTAX (for 'ntn api'):
  Header:Value     HTTP header                  Accept:application/json
  name==value      Query parameter              page_size==100
  path=value       String body field            parent[page_id]=abc
  path:=json       JSON-typed body field        archived:=true

ENV VARS:
  NOTION_API_TOKEN     Public API integration token
  NOTION_ENV           local|dev|stg|prod
  NOTION_BASE_URL      Override base URL (login/workers)
  NOTION_API_BASE_URL  Override base URL (public API)
  NOTION_HOME          Override CLI data dir
  XDG_CONFIG_HOME      XDG config root
  XDG_CACHE_HOME       XDG cache root
  NOTION_API_VERSION   Override Notion-Version header (default ${require('./config').NOTION_VERSION})
  NTN_VERBOSE          Log requests to stderr
`;

async function main(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (argv[0] === '--version' || argv[0] === '-V' || argv[0] === 'version') {
    process.stdout.write(VERSION + '\n');
    return;
  }
  const cmd = argv[0];
  const rest = argv.slice(1);
  const { positional, opts } = parseArgs(rest);
  if (opts.verbose) process.env.NTN_VERBOSE = '1';
  try {
    switch (cmd) {
      case 'login': {
        if (positional[0] === 'poll') return await require('./commands/login').runLoginPoll(opts);
        return await require('./commands/login').runLogin(opts);
      }
      case 'logout': return await require('./commands/logout').runLogout(opts);
      case 'reset':  return await require('./commands/logout').runReset(opts);
      case 'api':    return await require('./commands/api').runApi(positional[0], opts, positional.slice(1));
      case 'search': return await require('./commands/search').runSearch(positional[0], opts);
      case 'pages':  return await require('./commands/pages').runPages(positional[0], positional[1], opts);
      case 'datasources': return await require('./commands/datasources').runDatasources(positional[0], positional[1], opts);
      case 'files':  return await require('./commands/files').runFiles(positional[0], positional[1], opts);
      case 'workers': return await require('./commands/workers').runWorkers(positional[0], positional.slice(1), opts);
      case 'tools':  return await require('./commands/tools').runTools(positional[0], positional[1], opts);
      case 'completion': return require('./commands/completion').runCompletion(positional[0]);
      case 'doctor': return await require('./commands/doctor').runDoctor(opts);
      case 'update': return await require('./commands/update').runUpdate(opts);
      case 'experiments': {
        // Read/write boolean flags in config.experiments
        const C = require('./config');
        const cfg = C.readJson(C.configFile(), {});
        if (!cfg.experiments) cfg.experiments = {};
        if (positional[0] === 'set' && positional[1]) {
          cfg.experiments[positional[1]] = positional[2] !== 'false';
          C.writeJson(C.configFile(), cfg);
        }
        require('./output').printJson(cfg.experiments);
        return;
      }
      default:
        process.stderr.write(`error: unknown command '${cmd}'. Run 'ntn --help' for usage.\n`);
        process.exit(1);
    }
  } catch (e) {
    if (process.env.NTN_VERBOSE) console.error(e.stack);
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { main };
