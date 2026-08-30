# dsh-outline-auto

[简体中文](./README.zh-CN.md)

A DeepSeek Harness plugin that searches and reads an [Outline](https://www.getoutline.com/) knowledge base from your conversation. Give it a keyword — it returns matching documents with **titles, snippets, and links**; ask for one of them and it returns the **full content in Markdown**. Approved write tools can create, update, and delete documents, with an approval prompt before every write.

> Project status: 0.3.0. The current feature set is covered by unit tests, a Mock-server smoke, and a settings-chain integration check. The supported DSH baseline is `0.1.1-rc.2`; older Harness builds are not certified.


## The core idea

- The knowledge base is one search away: **you give a keyword, it gives you document links**.
- Read operations are available without write access; write operations are separately approved by the user.
- Each user brings their own credentials: **fill in the card in the GUI, no config files**.
- Setup per team member is the same three steps: install → restart → configure.

## Features

- **Ten tools** — search, read, count, list collections, resolve paths, list children, return a document template, create, update, and delete.
- **Clickable results** — document links are resolved to absolute URLs against your `baseUrl` (Outline returns relative paths); snippets and titles are cleaned of HTML tags so results render cleanly in chat.
- **Document read cache (60s TTL)** — re-reading the same document within a session does not hit the API again.
- **GUI configuration card** — Settings → Plugins → plugin configuration, an **Outline Knowledge Base** card matching the official card UI; fill in `baseUrl` and API token, click save, done.
- **Per-user credentials** — every user configures their own token in the GUI (stored under `$DSH_HOME/settings.yaml`, never in git); ideal for team distribution.
- **Safe when unconfigured** — the plugin loads normally and tools return clear Chinese error messages; the GUI is never blocked.
- **Live updates** — saving the card applies immediately, no restart; configuration priority: GUI card → environment variables → plugin config row.
- **Enable/disable** — listed in Settings → Plugins → Plugin list after the host entry is active; the configuration card is under Settings → Plugins → Plugin configuration.
- **Ready to distribute** — install from the public GitHub repository or archive after the release checklist below passes. Recipients should use the DSH plugin installer instead of manually editing profile bundles.

## Requirements

| Component | Baseline |
| --- | --- |
| Node.js | 22.13 or newer |
| DeepSeek Harness | `0.1.1-rc.2` (required baseline) |
| Outline instance | reachable from your machine (intranet / VPN), with an API token (Outline → Settings → API keys) |

## Installation

### Recommended: DSH-managed install

Install from the public GitHub repository, pinned to the latest release tag:

```bash
dsh plugin --profile web add git+https://github.com/huangfuren/dsh-outline-auto.git#v0.3.0
```

The `#v0.3.0` suffix pins the exact release; omit it to track the latest commit on `main`.

Restart `dsh web` after installation. The command updates the profile manifest and activates the package's `dsh.bundle` patch. Do not add a second manual `insert` row: duplicate loader ids can prevent the Harness from starting.

For a local checkout or extracted archive:

```bash
dsh plugin --profile web add link:/absolute/path/to/dsh-outline-auto
```

The directory must contain `package.json`, `lib/index.js`, `client.js`, `cordis.patch.yml`, and `dsh.plugin.json`. Build the package before distributing an archive:

```bash
pnpm build
```

### Legacy hot-install script

The `scripts/hot-install.mjs` flow is intended for local development only. It creates a profile link and a patch row, so keep the checkout in a stable directory. Do not use it as the public distribution instructions.

### Recovery after a failed install

```bash
dsh plugin --profile web why dsh-outline-auto
```

If startup reports that it cannot resolve `dsh-outline-ai`, an older renamed entry remains in `%USERPROFILE%/.dsh/profiles/web/package.json` or the profile `cordis.patch.yml`. Remove that stale dependency or insert row, then run the recommended install command again. Do not rename the current package back to the old id.

If the package loads but the card is absent, restart `dsh web`, open Settings → Plugins, check **Plugin list** for `dsh-outline-auto`, then check **Plugin configuration**. A failed host entry will not expose its settings namespace.

## Configuration

The recommended way is the **GUI card** (Settings → Plugins → plugin configuration → Outline Knowledge Base):

| Field | Description |
| --- | --- |
| Service URL (baseUrl) | Outline instance root, e.g. `https://outline.example.com` |
| API Token | create one at Outline → Settings → API keys |
| Writable paths (empty = read-only) | comma-separated directory paths, e.g. `Collection A,Knowledge Base/Dir 1`; only these directories and their children are writable |

Click **Save** — applies immediately. Alternatively, configure via environment variables (`OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN`) or the plugin config row in `cordis.patch.yml`.

**Read-only by default (v0.3.0)**: with no writable paths configured, all write tools (`outline_create` / `outline_update_document` / `outline_delete`) refuse to run — no approval prompt is even shown. To allow writes, list the directories that may be modified. A path like `Knowledge Base/Dir 1` covers every child under `Dir 1`; a bare `Collection A` covers the whole collection. Any path that cannot be resolved (missing collection, invisible directory, moved document) is refused — writes always fail closed.

The public package must not contain organization-specific collection names, URLs, tokens, or document examples. Deployment-specific values are configured per installation — never publish an internal collection name as a schema default or UI placeholder.

### Migrating from 0.2.x

0.3.0 removes the `protectedCollections` deny-list in favor of the `writablePaths` allow-list. After upgrading, **every write is refused until you configure writable paths**. If you previously protected a collection via the deny-list, simply leave it out of `writablePaths` — a collection that is not listed is not writable. Delete the old `protectedCollections` setting from your plugin config row, then set `writablePaths` to the directories you actually write to.

## Tools

| Tool | Description |
| --- | --- |
| `outline_search(query, limit?, collectionId?, userId?, updatedAfter?)` | Keyword search; returns the match **total**, plus title, snippet, document id and link per hit. Optional filters: collection, author (userId), updated-after. |
| `outline_get_document(id, maxLength?)` | Fetch a document's full Markdown by id; `maxLength` caps the returned text (default 20000). |
| `outline_count()` | Total number of documents in the knowledge base (`documents.list` total, exact; excludes trashed/deleted — the true total may be slightly higher). |
| `outline_list_collections()` | List visible collections (id, name, permission, document count). |
| `outline_resolve_path(path)` | Resolve a human path like `Knowledge Base/Directory A/Subdirectory` into `collectionId` + `parentDocumentId`; returns the resolved full path. |
| `outline_list_children(parentId)` | List direct child documents of a directory (parent document). |
| `outline_doc_template()` | Return the standard requirement-document template (Markdown) + required section list — call it before writing a requirement doc. |
| `outline_create(collectionId, title, text, publish?, parentDocumentId?)` | **Write** — create a document (default published; nest under a directory via `parentDocumentId`). **Requires approval** showing the resolved full path. |
| `outline_update_document(id, title?, text?)` | **Write** — update a document's title/body. **Requires approval** showing the document path. |
| `outline_delete(id)` | **Write, irreversible** — delete a document. **Double approval**: a first prompt, then a second confirmation before deletion. |

> Writes are restricted to the **writable paths** configured per deployment (read-only when empty). The public package ships with no organization-specific default.

### Workflow: writing a requirement document (common task)

See the full SOP: [`docs/workflow-requirement-doc.zh.md`](docs/workflow-requirement-doc.zh.md) — locate the directory (`outline_resolve_path`) → fetch the template (`outline_doc_template`) → draft → create with approval → verify.

## Release checklist

- Verify the package with the exact supported DSH baseline and Node.js baseline.
- Run `pnpm typecheck`, `pnpm build`, `pnpm test`, and `node scripts/smoke.mjs`.
- Inspect the archive contents: include built `lib/`, `client.js`, both manifests, the patch, and public documentation; exclude `node_modules`, `.git`, settings files, tokens, internal URLs, and internal document names.
- Install the archive or GitHub URL into a clean `web` profile and confirm both Settings -> Plugins -> Plugin list and Plugin configuration.
- Search the release tree for organization-specific names before publishing. A failed check blocks the release.

## Development

```bash
pnpm typecheck          # strict tsc check
pnpm build              # emit lib/
pnpm test               # vitest unit tests (mock fetch: success/empty/401/403/404/429/network/bad response)
node scripts/smoke.mjs  # local Mock Outline server, end-to-end smoke (prints SMOKE PASS)
node scripts/verify.mjs                # real settings → search → count chain (add --create for the create+cleanup chain)
```

The client half (`client.js`) is a dependency-free single-file module — no build step. The real-search verification script requires `OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN` env vars.

## License

[MIT](./LICENSE)
