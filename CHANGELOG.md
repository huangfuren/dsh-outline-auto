# Changelog

All notable changes to this project are documented here. Release-specific notes are also published on GitHub Releases.

## [Unreleased]

### Added

- Placeholder for the next release.

## [v0.3.0] - 2026-08-30

### Added

- **Writable-path allow-list with read-only default** (`writablePaths`): comma-separated directory paths (`Collection A` or `Collection A/Dir 1/Sub`); only those directories and their children may be written. With no paths configured the plugin is read-only and every write tool refuses to run — no approval prompt is even shown.
- `parseWritablePaths` / `resolvePathGuard`: prefix-matched, fail-closed directory guard (missing collection, unresolvable path, or out-of-whitelist target all refuse the write).
- Settings card reworked to match the house style: per-field status badges (Configured/Not configured; Writable/Read-only), API token masked with stars (never echoed back in plaintext), a Remove button per configured field (confirmation then immediate clear), a saved confirmation line, and a collapsed-card header badge.
- Plugin settings card ordering fix: the `settings.plugin.item` keyed slot sorts by `priority` (registration order), so the card registers with `priority: -1` to stay on top.

### Changed

- **Breaking**: the deny-list (`protectedCollections` / `FORBIDDEN_WRITE_COLLECTIONS`) is replaced by the `writablePaths` allow-list. After upgrading, every write is refused until writable paths are configured; a collection that is not listed is not writable.
- The settings `base` layer now merges the plugin config row and environment variables (env wins over the config row), so the client card sees deployment-provided connection info and reports "Configured" accordingly.

### Removed

- `protectedCollections` config field, `FORBIDDEN_WRITE_COLLECTIONS`, and the name-based deny-list guard.

### Security

- Read-only by default: with an empty whitelist, all write operations are refused before any approval prompt.
- API token is masked in the settings card and never displayed as plaintext.

### Fixed

- Organization-specific names scrubbed from source, tests, docs, and READMEs (public package ships with no deployment defaults).
