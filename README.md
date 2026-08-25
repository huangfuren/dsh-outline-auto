# dsh-outline-ai

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/huangfuren/dsh-outline-ai)](https://github.com/huangfuren/dsh-outline-ai)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-plugin-0B3D91.svg)](https://github.com/deepseek-ai)

A **DeepSeek Harness (DSH) web plugin** that lets you **search and read documents from an [Outline](https://www.getoutline.com/) knowledge base directly in your conversation**.

Give it a keyword — it returns matching documents with **titles, snippets, and links**. Ask for one of them and it returns the **full content in Markdown**. The plugin is **read-only**: it never modifies your document sources or sync pipeline.

## Features

| Tool | Description |
| --- | --- |
| `outline_search(query, limit?)` | Keyword search → matching docs with title, snippet, document id and link |
| `outline_get_document(id, maxLength?)` | Full Markdown content by document id (length-capable) |

- **GUI configuration card** — fill in `baseUrl` and API token in Settings → Plugins, no config file editing
- **Per-user credentials** — every user configures their own token in the GUI; ready for team distribution
- **Safe when unconfigured** — the plugin loads normally and tools return clear Chinese/English error messages
- **Live updates** — saving the card applies immediately, no restart needed
- **Enable/disable** — appears in the plugin list; one commented line toggles it

## Requirements

- DeepSeek Harness (`dsh`) with a `web` profile
- An Outline instance reachable from your machine (intranet / VPN)
- An Outline **API token** (Outline → Settings → API keys)

## Install

```sh
# From GitHub (requires dsh CLI):
dsh plugin --profile web add git+https://github.com/huangfuren/dsh-outline-ai.git

# Or from a local directory:
dsh plugin --profile web add /path/to/dsh-outline-ai
```

Restart `dsh web` after installing (the host half loads at startup).

> Distributing the plugin as a zip? Exclude `node_modules` and `.git` — DSH resolves `@deepseek-ai/*` automatically at runtime, so recipients need no junction.

## Configure (recommended: GUI card)

1. Open **Settings → Plugins → plugin configuration** in the DSH web UI
2. Find the **Outline Knowledge Base** card
3. Fill in:
   - **Service URL (baseUrl)** — e.g. `https://outline.example.com`
   - **API Token** — create one at Outline → Settings → API keys
4. Click **Save** — applies immediately

Configuration priority: **GUI card (`settings.yaml`) → environment variables → plugin config row**.

### Alternative configuration

```sh
# Environment variables (read at process start):
OUTLINE_BASE_URL=https://outline.example.com
OUTLINE_API_TOKEN=xxx
```

```yaml
# Or the plugin config row in ~/.dsh/profiles/web/cordis.patch.yml:
- id: outline-ai
  config:
    baseUrl: https://outline.example.com
    apiToken: xxx
```

## Usage

Once configured, just ask in any conversation:

- "Search the knowledge base for **TDD**" → returns matching docs with links
- "Read the document about **onboarding**" → returns the full Markdown content

The tools are also available directly: `outline_search` / `outline_get_document`.

## Enable / Disable

The plugin is listed in **Settings → Plugins → plugin list** (read-only status). Toggle it in `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
# Disable (uncomment to apply; hot-reload, no GUI restart needed):
# - id: outline-ai
#   disabled: true
```

## Uninstall

```sh
dsh plugin --profile web remove dsh-outline-ai
```

## Development

```sh
pnpm install
pnpm typecheck          # strict tsc check
pnpm build              # emit lib/
pnpm test               # vitest unit tests (mock fetch: success/empty/401/403/404/429/network/bad response)
node scripts/smoke.mjs  # local Mock Outline server, end-to-end smoke (prints SMOKE PASS)
node scripts/verify-settings.mjs   # settings namespace → settings.yaml → real search, full-chain check
```

The client half (`client.js`) is a dependency-free single-file module — no build step. Requires `OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN` env vars for the real-search verification script.

## Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| "Authentication failed (HTTP 401/403)" | Invalid token or no access; regenerate at Outline → Settings → API keys |
| "Cannot connect" or timeout | Wrong baseUrl or unreachable network (intranet/VPN); `curl <baseUrl>/api/documents.search` to check |
| HTTP 404 | Wrong document id or no access |
| "Not configured" error | Fill in baseUrl and token (see Configure) |

## License

[MIT](LICENSE)
