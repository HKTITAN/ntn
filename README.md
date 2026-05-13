# ntn

This is a cross-platform, pure-Node.js port of the official Notion CLI (`ntn`). The official CLI currently distributed via npm downloads pre-built Rust binaries that do not support Windows. This port replaces those binaries with a JS implementation mapped to Notion's public API endpoints, enabling full usage on Windows alongside macOS and Linux.

## Setup

```bash
npm install -g "github:HKTITAN/ntn"
```

Because this is a pure Node.js CLI, it will run anywhere Node is installed.

## Usage

```bash
ntn --help
```

Set your Notion API token as an environment variable before making requests:

```bash
# On Windows (PowerShell)
$env:NOTION_API_TOKEN="secret_..."

# On macOS/Linux
export NOTION_API_TOKEN="secret_..."
```

Make API requests just like the official CLI:

```bash
ntn api v1/users
ntn api v1/pages parent[page_id]=abc123 archived:=true
```

## Features

- **Cross-platform**: Runs on Windows, Linux, and macOS without needing pre-compiled Rust binaries.
- **Inline Payload Syntax**: Maps inline payload syntax (e.g., `parent[page_id]=abc123`) directly into JSON payloads.
- **Worker Support**: Stubs and passes through worker commands.

## Note on Private Workers API
The `ntn workers` commands interface with a private, undocumented Notion API. As the Rust binary's internal models aren't publicized, this port acts as a generic JSON pass-through to `/api/v3/*`.

## License
MIT
