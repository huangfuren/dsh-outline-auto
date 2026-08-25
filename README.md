# dsh-outline-ai

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/huangfuren/dsh-outline-ai)](https://github.com/huangfuren/dsh-outline-ai)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-plugin-0B3D91.svg)](https://github.com/deepseek-ai)

> **EN** — A [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) web plugin that lets you **search and read documents from an [Outline](https://www.getoutline.com/) knowledge base directly in your conversation**.
>
> **中文** — 一个 DeepSeek Harness（DSH）Web 插件，让你**直接在对话中搜索并读取 [Outline](https://www.getoutline.com/) 知识库文档**。

Give it a keyword — it returns matching documents with **titles, snippets, and links**. Ask for one of them and it returns the **full content in Markdown**. The plugin is **read-only**: it never modifies your document sources or sync pipeline.

给它一个关键词，它会返回匹配的文档**标题、摘要与链接**；点开某篇，返回**完整的 Markdown 全文**。插件**只读**，不会修改你的文档源，也不参与同步流程。

## Features · 功能

| Tool / 工具 | Description / 说明 |
| --- | --- |
| `outline_search(query, limit?)` | Keyword search → matching docs with title, snippet, document id and link<br/>关键词搜索 → 返回标题、命中片段、文档 id 与链接 |
| `outline_get_document(id, maxLength?)` | Full Markdown content by document id (length-capable)<br/>按文档 id 获取全文（Markdown 格式，超长可截断） |

- **GUI configuration card** — fill in `baseUrl` and API token in Settings → Plugins, no config file editing
- **GUI 配置卡片** — 在 设置 → 插件 里直接填 `baseUrl` 和 API Token，无需编辑配置文件
- **Per-user credentials** — every user configures their own token in the GUI; ready for team distribution
- **每人各填各的 token** — 每个用户在 GUI 里配置自己的凭据即可，适合团队分发
- **Safe when unconfigured** — the plugin loads normally and tools return clear error messages
- **未配置也安全** — 插件正常加载，工具返回明确的中文错误提示，不影响 GUI 启动
- **Live updates** — saving the card applies immediately, no restart needed
- **保存即生效** — 卡片保存后立即生效，无需重启
- **Enable/disable** — appears in the plugin list; one commented line toggles it
- **可启停** — 出现在插件列表中，注释一行即可开关

## Requirements · 环境要求

- DeepSeek Harness (`dsh`) with a `web` profile / 安装有 `web` profile 的 DeepSeek Harness（DSH）
- An Outline instance reachable from your machine (intranet / VPN) / 机器能访问你的 Outline 实例（内网 / VPN）
- An Outline **API token** (Outline → Settings → API keys) / 一个 Outline **API Token**（Outline → 设置 → API 密钥）

## Install · 安装

```sh
# From GitHub (requires dsh CLI) / 从 GitHub 安装（需 dsh CLI）：
dsh plugin --profile web add git+https://github.com/huangfuren/dsh-outline-ai.git

# Or from a local directory / 或从本地目录安装：
dsh plugin --profile web add /path/to/dsh-outline-ai
```

Restart `dsh web` after installing (the host half loads at startup).
安装后需**重启 `dsh web`**（插件的 host 部分在启动时加载）。

> Distributing the plugin as a zip? Exclude `node_modules` and `.git` — DSH resolves `@deepseek-ai/*` automatically at runtime, so recipients need no junction.
> 以压缩包分发时请排除 `node_modules` 与 `.git`——DSH 运行时会自动解析 `@deepseek-ai/*`，接收者无需重建 junction。

## Configure · 配置

### Recommended: GUI card / 推荐：GUI 配置卡片

1. Open **Settings → Plugins → plugin configuration** in the DSH web UI / 打开 DSH Web 的 **设置 → 插件 → 插件配置**
2. Find the **Outline Knowledge Base** card / 找到 **Outline 知识库** 卡片
3. Fill in / 填写：
   - **Service URL (baseUrl)** — e.g. `https://outline.example.com` / 服务地址，如 `https://outline.example.com`
   - **API Token** — create one at Outline → Settings → API keys / Outline → 设置 → API 密钥 生成
4. Click **Save** — applies immediately / 点 **保存**，立即生效

Configuration priority / 配置优先级：**GUI card (`settings.yaml`) → environment variables → plugin config row** / **GUI 卡片 → 环境变量 → 插件配置行**

### Alternative configuration / 备选配置方式

```sh
# Environment variables (read at process start) / 环境变量（进程启动时读取）：
OUTLINE_BASE_URL=https://outline.example.com
OUTLINE_API_TOKEN=xxx
```

```yaml
# Or the plugin config row in ~/.dsh/profiles/web/cordis.patch.yml / 或插件配置行：
- id: outline-ai
  config:
    baseUrl: https://outline.example.com
    apiToken: xxx
```

## Usage · 使用

Once configured, just ask in any conversation / 配置好后，直接在对话里说：

- "Search the knowledge base for **TDD**" → returns matching docs with links / 「搜一下知识库里的 TDD」→ 返回带链接的匹配文档
- "Read the document about **onboarding**" → returns the full Markdown content / 「读一下新人培训那篇」→ 返回完整 Markdown 全文

The tools are also available directly: `outline_search` / `outline_get_document`.
工具也可直接调用：`outline_search` / `outline_get_document`。

## Enable / Disable · 启停

The plugin is listed in **Settings → Plugins → plugin list** (read-only status). Toggle it in `~/.dsh/profiles/web/cordis.patch.yml`:
插件会出现在 **设置 → 插件 → 插件列表**（只读状态）。启停开关在 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
# Disable (uncomment to apply; hot-reload, no GUI restart needed) / 禁用（取消注释即生效，热加载，无需重启 GUI）：
# - id: outline-ai
#   disabled: true
```

## Uninstall · 卸载

```sh
dsh plugin --profile web remove dsh-outline-ai
```

## Development · 本地开发

```sh
pnpm install
pnpm typecheck          # strict tsc check / tsc 严格检查
pnpm build              # emit lib/ / 产出 lib/
pnpm test               # vitest unit tests (mock fetch: success/empty/401/403/404/429/network/bad response)
node scripts/smoke.mjs  # local Mock Outline server, end-to-end smoke (prints SMOKE PASS)
node scripts/verify-settings.mjs   # settings namespace → settings.yaml → real search, full-chain check
```

The client half (`client.js`) is a dependency-free single-file module — no build step. The real-search verification script requires `OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN` env vars.
客户端半区（`client.js`）是零依赖单文件模块，无需构建。真实搜索验证脚本需要 `OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN` 环境变量。

## Troubleshooting · 常见问题

| Symptom / 现象 | Cause & fix / 原因与处理 |
| --- | --- |
| "Authentication failed (HTTP 401/403)"<br/>「认证失败（HTTP 401/403）」 | Invalid token or no access; regenerate at Outline → Settings → API keys<br/>token 无效或无权访问；在 Outline 设置 → API 密钥重新生成 |
| "Cannot connect" or timeout<br/>「无法连接」或超时 | Wrong baseUrl or unreachable network (intranet/VPN); `curl <baseUrl>/api/documents.search` to check<br/>baseUrl 错误或网络不可达（内网/VPN）；用 `curl <baseUrl>/api/documents.search` 自查 |
| HTTP 404 | Wrong document id or no access / 文档 id 错误或无权访问 |
| "Not configured" error<br/>「未配置」报错 | Fill in baseUrl and token (see Configure) / 按上文「配置」补 baseUrl 与 token |

## License · 许可证

[MIT](LICENSE)
