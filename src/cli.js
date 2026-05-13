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
  .command('pages')
  .description('Manage pages')
  .argument('<action>', 'get/create/update/trash')
  .allowUnknownOption()
  .action((action, opts, cmd) => {
    console.log(`Command 'pages ${action}' is stubbed. Use 'ntn api v1/pages' instead for full control.`);
  });

program
  .command('files')
  .description('Upload and manage files')
  .argument('<action>', 'create/get/list')
  .option('--external-url <url>', 'External URL to upload')
  .allowUnknownOption()
  .action((action, options, cmd) => {
    console.log(`Command 'files ${action}' is stubbed in this node port.`);
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
