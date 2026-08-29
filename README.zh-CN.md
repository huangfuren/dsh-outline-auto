# dsh-outline-auto

[English](./README.md)

DeepSeek Harness 的 Outline 插件：在对话中搜索、读取并在用户审批后创建、更新或删除文档。插件只连接用户配置的 Outline 实例，不携带任何组织内部地址、token、集合名或文档内容。

> 当前版本：0.2.2。支持的 DeepSeek Harness 基线为 `0.1.1-rc.2`，Node.js 需要 22.13 或更高版本。

## 功能

- 搜索、读取、统计文档，并返回可点击的 Outline 链接。
- 列出集合、解析“集合/目录/子目录”路径、列出直接子文档。
- 提供通用需求文档模板。
- 创建、更新和删除属于写操作，每次执行前需要用户审批；删除还需要第二次确认。
- 设置卡片位于 设置 -> 插件 -> 插件配置；插件状态位于 设置 -> 插件 -> 插件列表。
- 未配置 Outline 地址或 token 时，插件仍可启动，工具会返回配置提示。

## 安装

### 推荐：DSH 管理安装

把 GitLab 仓库作为 web profile 依赖安装，将示例地址替换为实际发布地址：

```bash
dsh plugin --profile web add git+https://gitlab.example.com/<group>/dsh-outline-auto.git
```

安装后重启 `dsh web`。该命令会更新 profile manifest 并激活插件的 `dsh.bundle` patch。不要再次手工添加同一个 `insert` 行，重复 Loader id 可能导致 Harness 启动失败。

本地 checkout 或解压后的目录可以使用：

```bash
dsh plugin --profile web add link:/absolute/path/to/dsh-outline-auto
```

分发压缩包必须包含 `package.json`、`lib/index.js`、`client.js`、`cordis.patch.yml` 和 `dsh.plugin.json`；构建前先执行：

```bash
pnpm build
```

### 旧版热安装脚本

`scripts/hot-install.mjs` 只建议用于本地开发。它会创建 profile 链接并追加 patch 行，公开分发不要把它作为标准安装方式。

### 启动失败恢复

```bash
dsh plugin --profile web why dsh-outline-auto
```

如果报无法解析 `dsh-outline-ai`，说明 `%USERPROFILE%/.dsh/profiles/web/package.json` 或 profile 的 `cordis.patch.yml` 仍有旧名称。删除旧依赖或旧 `insert` 行，再执行推荐安装命令；不要把当前包名改回旧 id。

如果插件已加载但看不到卡片，重启 `dsh web`，先在插件列表确认 `dsh-outline-auto`，再打开插件配置。宿主条目失败时不会注册 settings 命名空间。

## 配置

推荐在 设置 -> 插件 -> 插件配置 中填写：

| 字段 | 说明 |
| --- | --- |
| Service URL | Outline 实例根地址，例如 `https://outline.example.com` |
| API Token | 在 Outline 的 API keys 页面创建 |
| Protected collections | 逗号分隔的受保护集合名；每个部署自行配置 |

也可以使用环境变量 `OUTLINE_BASE_URL` 和 `OUTLINE_API_TOKEN`，或在 `cordis.patch.yml` 的插件配置行中设置。公开包不得把内部集合名写入 schema 默认值、界面文案、测试数据或示例 URL。

## 兼容性与发布检查

- 使用 DSH `0.1.1-rc.2` 或更高的同一兼容范围测试；更早版本没有设置槽位和客户端注入兼容保证。
- 执行 `pnpm typecheck`、`pnpm build`、`pnpm test` 和 `node scripts/smoke.mjs`。
- 压缩包排除 `node_modules`、`.git`、settings 文件、token、内部地址和内部文档名称。
- 在干净的 `web` profile 中安装 GitLab 地址或压缩包，确认插件列表和插件配置两个入口都可见。
- 发布前搜索整个发布目录中的组织专属名称；检查失败就停止发布。

## 工具

`outline_search`、`outline_get_document`、`outline_count`、`outline_list_collections`、`outline_resolve_path`、`outline_list_children`、`outline_doc_template`、`outline_create`、`outline_update_document` 和 `outline_delete`。

## 开发

```bash
pnpm typecheck
pnpm build
pnpm test
node scripts/smoke.mjs
```

真实 Outline 验证脚本需要环境变量 `OUTLINE_BASE_URL` 和 `OUTLINE_API_TOKEN`。token 只通过环境变量或用户本机 settings 传入，不要写入仓库。

## License

[MIT](./LICENSE)
