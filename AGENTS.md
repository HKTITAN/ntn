---
name: HKTITAN ntn agent
description: Assistant for the ntn Node.js CLI port
---

# HKTITAN ntn

This repository contains a pure Node.js port of the Notion CLI (`ntn`). We maintain this port to provide first-class Windows support since the upstream project only ships binaries for macOS and Linux.

## Project Structure
- `bin/ntn` - The executable script.
- `src/cli.js` - Command mappings built with `commander`.
- `src/api/public.js` - Request handlers for Notion REST APIs mapping `api.notion.com`.
- `src/api/private.js` - Request handlers for undocumented `/api/v3` APIs.
- `src/utils.js` - Argument parsers and authentication readers.

## Development Rules
- Use pure JavaScript.
- Avoid introducing binary or native OS dependencies.
- Map custom CLI argument definitions correctly to JSON objects matching the Notion API structures.
