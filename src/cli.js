const { Command } = require('commander');
const { apiCmd } = require('./api/public.js');
const { workersCmd } = require('./api/private.js');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('ntn')
  .description('Notion CLI (Node Port)')
  .version(packageJson.version);

// Public API surface
program
  .command('api')
  .description('Make authenticated requests to the Notion API')
  .argument('<path>', 'API endpoint path (e.g. v1/users)')
  .option('-X, --method <method>', 'HTTP method', 'GET')
  .allowUnknownOption()
  .action((path, options, cmd) => {
    // Pass raw args (unknown options) to parse inline args
    apiCmd(path, options, cmd.args.slice(1));
  });

program
  .command('search')
  .description('Search Notion')
  .allowUnknownOption()
  .action((options, cmd) => {
    apiCmd('v1/search', { method: 'POST' }, cmd.args);
  });

program
  .command('datasources')
  .description('Manage datasources')
  .argument('<action>', 'query/resolve')
  .allowUnknownOption()
  .action((action, options, cmd) => {
    apiCmd(`v1/data_sources/${action}`, { method: 'POST' }, cmd.args.slice(1));
  });

program
  .command('pages')
  .description('Manage pages')
  .argument('<action>', 'get/create/update/trash')
  .argument('[id]', 'Page ID (for get/update/trash)')
  .allowUnknownOption()
  .action((action, id, opts, cmd) => {
    const rawArgs = cmd.args.slice(id ? 2 : 1);
    if (action === 'get') apiCmd(`v1/pages/${id}`, { method: 'GET' }, rawArgs);
    else if (action === 'create') apiCmd('v1/pages', { method: 'POST' }, rawArgs);
    else if (action === 'update') apiCmd(`v1/pages/${id}`, { method: 'PATCH' }, rawArgs);
    else if (action === 'trash') apiCmd(`v1/pages/${id}`, { method: 'PATCH' }, ['archived:=true', ...rawArgs]);
  });

program
  .command('files')
  .description('Upload and manage files')
  .argument('<action>', 'create/get/list')
  .argument('[id]', 'File ID (for get)')
  .option('--external-url <url>', 'External URL to upload')
  .allowUnknownOption()
  .action((action, id, options, cmd) => {
    const rawArgs = cmd.args.slice(id && action === 'get' ? 2 : 1);
    if (action === 'list') {
      apiCmd('v1/file_uploads', { method: 'GET' }, rawArgs);
    } else if (action === 'get') {
      apiCmd(`v1/file_uploads/${id}`, { method: 'GET' }, rawArgs);
    } else if (action === 'create') {
      if (options.externalUrl) {
        apiCmd('v1/file_uploads', { method: 'POST' }, ['externalUrl:=' + options.externalUrl, ...rawArgs]);
      } else {
        const fs = require('node:fs');
        try {
          const buf = fs.readFileSync(0); // read from stdin
          if (buf.length > 0) {
            const { request } = require('./api/public.js');
            request('POST', 'v1/file_uploads', buf).then(res => {
              if (res) console.log(JSON.stringify(res, null, 2));
            });
          } else {
            console.error("Error: Please pipe a file to this command or use --external-url.");
            process.exitCode = 1;
          }
        } catch(e) {
          console.error("Error reading from stdin.", e.message);
          process.exitCode = 1;
        }
      }
    }
  });

// Setup workers passthrough
program
  .command('workers')
  .description('Manage Notion Workers')
  .argument('[subcommand]', 'list/deploy/new', 'list')
  .allowUnknownOption()
  .action((subcommand, options, cmd) => {
    workersCmd(subcommand, cmd.args.slice(1));
  });

// Fallback login command
program
  .command('login')
  .description('Authenticate with Notion (stubbed - use NOTION_API_TOKEN)')
  .action(() => {
    console.log('Login flow is currently undocumented (requires ntn.dev).');
    console.log('Please set the environment variable NOTION_API_TOKEN instead:');
    if (process.platform === 'win32') {
        console.log('  $env:NOTION_API_TOKEN="secret_..."');
    } else {
        console.log('  export NOTION_API_TOKEN="secret_..."');
    }
  });

program.parse(process.argv);
