# Changelog

All notable changes to this project are documented here. Release-specific notes are also published on GitHub Releases.

## [Unreleased]

### Added

- Placeholder for the next release.

## [v0.4.0] - 2026-08-30

### Added

- **429 限流自动重试**：请求被限流时按 `Retry-After` 或指数退避自动重试（最多 3 次），重试后仍失败才报错。
- **HTTPS 校验**：公网地址必须使用 `https://`（localhost 与内网私有地址除外），避免 Token 明文传输。
- **可配置缓存 TTL**：新增 `cacheTtlMs` 配置（默认 60000，范围 1000–300000），文档与集合缓存有效期可调；文档缓存增加条目上限（200 条，超限淘汰最旧），防止长时间运行内存膨胀。

## [v0.3.1] - 2026-08-30

### Fixed

- **分页补齐**：`outline_list_collections` 与 `outline_list_children` 改为循环翻页直到收齐 `pagination.total`，不再因单页上限（100 条）漏集合或漏子文档。
- **搜索翻页**：`outline_search` 新增 `offset` 参数，可配合 `limit` 翻页查看更多结果。
- **写后缓存失效**：`outline_create` / `outline_update_document` / `outline_delete` 执行成功后主动清除对应文档缓存与集合缓存，避免 60s 缓存窗口内读到旧内容。

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
