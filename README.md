# ntn

A complete, cross-platform Node.js port of the official Notion CLI (`ntn`). The
upstream npm package distributes pre-built Rust binaries that do not support
Windows; this port replaces them with a pure JavaScript implementation that
runs on **Windows, macOS, and Linux** anywhere Node.js ≥ 18 is installed.

It implements both the **public Notion API surface** (documented at
https://developers.notion.com) and the reverse-engineered **private workers /
login API** at `/api/v3/workers*`, including the browser-based OAuth login
flow.

## Install

```bash
npm install -g "github:HKTITAN/ntn"
```

No native deps, no preinstall step.

## Authenticate

Two independent auth surfaces, exactly like upstream:

**1. Public API (`ntn api`, `ntn pages`, `ntn search`, `ntn datasources`,
`ntn files`)** — uses a Notion **integration token** from
https://www.notion.so/profile/integrations:

```powershell
# Windows PowerShell
$env:NOTION_API_TOKEN = "secret_..."
```

```bash
# macOS / Linux
export NOTION_API_TOKEN="secret_..."
```

**2. Workspace session (`ntn workers`, `ntn tools call`)** — interactive
browser OAuth:

```bash
ntn login
# Opens browser, shows a verification code to confirm, then polls for
# completion. If the browser doesn't open, the URL is printed.
ntn login poll        # resume a pending session
ntn logout            # forget current env
ntn logout --all      # forget all envs
ntn reset --yes       # wipe all CLI data
```

Tokens are stored in `auth.json` under the CLI home dir:

| OS      | Default path                                     |
|---------|--------------------------------------------------|
| Windows | `%APPDATA%\notion-cli\auth.json` (separate from Notion desktop app) |
| macOS   | `~/.config/notion/auth.json`                     |
| Linux   | `$XDG_CONFIG_HOME/notion/auth.json` (or `~/.config/notion/`) |

Override via `NOTION_HOME=/path/to/dir`.

## Commands

```
ntn login [poll] [--env local|dev|stg|prod]
ntn logout [--all] [--env ENV]
ntn reset --yes
ntn doctor [--json]
ntn update

ntn api <path> [inputs...] [-X METHOD] [-d JSON] [--spec|--docs]
ntn api ls [--json]
ntn search [QUERY] [--filter JSON] [--sort JSON] [--limit N] [--start-cursor C]

ntn pages get <id> [--json]
ntn pages create --parent page:<id>|database:<id>|data-source:<id> [--title T] [--content MD]
ntn pages update <id> [--title T] [--content MD] [--replace-content] [--archived]
ntn pages trash <id>

ntn datasources query <data-source-id> [--filter JSON] [--sorts JSON] [--limit N] [--start-cursor C]
ntn datasources resolve <database-id>
ntn datasources get <data-source-id>

ntn files list [--limit N]
ntn files get <upload-id>
ntn files create [--file PATH | --external-url URL | <stdin>] [--filename NAME] [--content-type MIME]
ntn files complete <upload-id>

ntn workers list [--json|--plain]
ntn workers get [<worker-id>]
ntn workers new <name>
ntn workers deploy [--name NAME]
ntn workers delete [<worker-id>] --yes
ntn workers runs list [<worker-id>] [--limit N]
ntn workers runs logs <run-id>
ntn workers env list|set|unset|pull|push [<worker-id>] [KEY=VALUE | KEY | FILE]
ntn workers capabilities list [<worker-id>]
ntn workers webhooks list [<worker-id>]
ntn workers sync status|pause|resume|trigger [<worker-id>] [<capability-key>]
ntn workers sync state get|reset [<worker-id>] <capability-key> [--yes]
ntn workers oauth start|token|show-redirect-url [<worker-id>] [<capability-key>]
ntn workers usage [<worker-id>]
ntn workers exec [<worker-id>] <function-name> [--data JSON]

ntn tools call <NAME> [--data JSON | <stdin>]
ntn completion <bash|zsh|fish|powershell|elvish>
```

## Inline request input syntax (for `ntn api`)

Same as upstream / httpie:

| Form              | Effect              | Example                          |
|-------------------|---------------------|----------------------------------|
| `Header:Value`    | HTTP header         | `Accept:application/json`        |
| `name==value`     | Query parameter     | `page_size==100`                 |
| `path=value`      | String body field   | `parent[page_id]=abc-123`        |
| `path:=json`      | JSON-typed field    | `archived:=true`                 |

Method auto-selects: `POST` when a body is present, `GET` otherwise.
`-X/--method` always wins. Body JSON may come from exactly one source: piped
stdin JSON, `--data`, or inline body inputs.

```bash
ntn api v1/users
ntn api v1/pages parent[page_id]=abc-123 properties[title][title][0][text][content]=Hi
ntn api v1/databases/abc-123/query --data '{"page_size":5}'
ntn api v1/users --docs   # prints docs URL
ntn api v1/users --spec   # prints raw OpenAPI metadata
ntn api ls                # list every endpoint
```

## Environments

```
--env local   http://localhost:3000        https://api-dev.notion.com
--env dev     https://dev.notion.so        https://api-dev.notion.com
--env stg     https://stg.notion.so        https://api-stg.notion.com
--env prod    https://www.notion.so        https://api.notion.com         (default)
```

Override with `NOTION_BASE_URL` / `NOTION_API_BASE_URL`.

## Environment variables

| Var                 | Meaning                                                  |
|---------------------|----------------------------------------------------------|
| `NOTION_API_TOKEN`  | Public API integration token (overrides `auth.json`)     |
| `NOTION_API_VERSION`| `Notion-Version` header (default `2022-06-28`)           |
| `NOTION_ENV`        | `local`/`dev`/`stg`/`prod` (same as `--env`)             |
| `NOTION_BASE_URL`   | Base URL for login + workers                             |
| `NOTION_API_BASE_URL` | Base URL for public API                                |
| `NOTION_HOME`       | CLI data dir (overrides XDG / APPDATA defaults)          |
| `XDG_CONFIG_HOME`   | XDG config root                                          |
| `XDG_CACHE_HOME`    | XDG cache root                                           |
| `NOTION_WORKERS_CONFIG_FILE` | Override path of `workers.json`                 |
| `NTN_VERBOSE`       | Log requests to stderr                                   |

## License

MIT
