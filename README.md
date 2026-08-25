# dsh-outline-ai

[简体中文](./README.zh-CN.md)

A DeepSeek Harness plugin that searches and reads an [Outline](https://www.getoutline.com/) knowledge base from your conversation. Give it a keyword — it returns matching documents with **titles, snippets, and links**; ask for one of them and it returns the **full content in Markdown**. Read-only: it never modifies your document sources or sync pipeline.

> Project status: 0.1.0. The current feature set is implemented and covered by unit tests, a Mock-server smoke, and a settings-chain integration check; cross-version compatibility beyond the development environment is not yet certified.


## The core idea

- The knowledge base is one search away: **you give a keyword, it gives you document links**.
- Read-only by design: the plugin only queries Outline, it never writes to your documents.
- Each user brings their own credentials: **fill in the card in the GUI, no config files**.
- Setup per team member is the same three steps: install → restart → configure.

## Features

- **Two tools** (`outline_search(query, limit?)` / `outline_get_document(id, maxLength?)`) — keyword search returns titles, snippets, document ids and links; document fetch returns full Markdown (length-capable).
- **GUI configuration card** — Settings → Plugins → plugin configuration, an **Outline Knowledge Base** card matching the official card UI; fill in `baseUrl` and API token, click save, done.
- **Per-user credentials** — every user configures their own token in the GUI (stored under `$DSH_HOME/settings.yaml`, never in git); ideal for team distribution.
- **Safe when unconfigured** — the plugin loads normally and tools return clear Chinese error messages; the GUI is never blocked.
- **Live updates** — saving the card applies immediately, no restart; configuration priority: GUI card → environment variables → plugin config row.
- **Enable/disable** — listed in Settings → Plugins → plugin list; one commented line in `cordis.patch.yml` toggles it with hot reload.
- **Ready to distribute** — install from GitHub in one command; recipients need no build step (DSH resolves `@deepseek-ai/*` at runtime) and no junction.

## Requirements

| Component | Baseline |
| --- | --- |
| Node.js | 22.13 or newer |
| DeepSeek Harness | tested against `0.1.1-rc.2` |
| Outline instance | reachable from your machine (intranet / VPN), with an API token (Outline → Settings → API keys) |

## Installation

Development (link install, live source):

```bash
dsh plugin --profile web add link:/path/to/dsh-outline-ai
```

GitHub (published):

```bash
dsh plugin --profile web add git+https://github.com/huangfuren/dsh-outline-ai.git
```

Restart `dsh web` after installing (the host half loads at startup; the client half registers the settings card).

> Distributing as a zip? Exclude `node_modules` and `.git` — recipients need no junction.

## Configuration

The recommended way is the **GUI card** (Settings → Plugins → plugin configuration → Outline Knowledge Base):

| Field | Description |
| --- | --- |
| Service URL (baseUrl) | Outline instance root, e.g. `https://outline.example.com` |
| API Token | create one at Outline → Settings → API keys |

Click **Save** — applies immediately. Alternatively, configure via environment variables (`OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN`) or the plugin config row in `cordis.patch.yml`.

## Tools

| Tool | Description |
| --- | --- |
| `outline_search(query, limit?)` | Keyword search; returns title, snippet, document id and link per match (limit up to 25). |
| `outline_get_document(id, maxLength?)` | Fetch a document's full Markdown by id; `maxLength` caps the returned text (default 20000). |

## Development

```bash
pnpm typecheck          # strict tsc check
pnpm build              # emit lib/
pnpm test               # vitest unit tests (mock fetch: success/empty/401/403/404/429/network/bad response)
node scripts/smoke.mjs  # local Mock Outline server, end-to-end smoke (prints SMOKE PASS)
node scripts/verify-settings.mjs  # settings namespace → settings.yaml → real search, full-chain check
```

The client half (`client.js`) is a dependency-free single-file module — no build step. The real-search verification script requires `OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN` env vars.

## License

[MIT](./LICENSE)
