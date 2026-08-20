# dsh-outline-kb Initial Baseline

Date: `2026-08-21`
Status: `initial dual-baseline snapshot`

## 1. Purpose
- 为 dsh-outline-kb 插件项目建立需求与架构双基线的起点，供后续对齐检查使用。
- 项目尚处设计阶段，本快照记录已确认的意图与已核实的事实，避免实现时漂移。

## 2. Workspace Structure
- `docs/aegis/` — Aegis 工作区（本目录）
- `src/` — 插件源码（待实现：index.ts / config.ts / client.ts / errors.ts / tools.ts）
- `tests/` — vitest 单测（待实现）
- `scripts/mock-outline-server.mjs` — 本地 Mock Outline API（待实现）
- `cordis.patch.yml` / `dsh.plugin.json` / `package.json` — 插件清单（待实现）
- 项目根：`D:\Program Files (x86)\CodeBuddy\deepseek\dsh-work\dsh-outline-kb`

## 3. Current Authority Surfaces
- DSH 官方文档：`docs/user/develop/basic/{tool,config,publish}.zh.md`（权威）
- DSH 源码：`packages/core/tools/src/schema.ts`（defineTool API）、`packages/web/tool-web/src/search.ts`（工具参考）
- Outline 官方 OpenAPI：`spec3.yml`（raw.githubusercontent.com/outline/openapi，已下载核实）
- 已装插件参考：dsh-outline（dsh.plugin.json / cordis.patch.yml / 打包约定）
- 权威缺口：无

## 4. Product / Requirement Baseline
### 4.1 Current Truth
- 已确认需求：DSH Web 插件 `dsh-outline-kb`，注册 `outline_search` + `outline_get_document` 两个 agent 工具，让用户在对话中检索/阅读公司 Outline 知识库文档。
- 目标状态：插件安装进 web profile，agent 可调用工具返回 Outline 文档标题/片段/全文 Markdown。
- 目标用户：公司内部使用 DSH 的同事；文档工作流为本地 Markdown → CI/CD → GitLab → 同步 Outline。
- 约束：公司 Outline 在内网，本机不可达 → 插件完全可配置（baseUrl/apiToken），开发验证用 Mock；DSH 源码零改动；只读不写。
- 验收标准（初版）：
  1. 插件构建 + typecheck 通过；
  2. vitest 单测（mock fetch）通过；
  3. 安装进 web profile，`dsh --profile web --dump-config` 组合成功且包含 outline-kb 行；
  4. Mock Outline server 冒烟端到端通过；
  5. 用户在可达内网的机器上配置真实实例后，`outline_search` / `outline_get_document` 可用。

### 4.2 Non-negotiables
1. 不改 DSH 源码；插件以 bundle 形式安装。
2. 工具只读 Outline，不 create/update/delete。
3. API token 不写入提交的配置/git。
4. 所有可调参数走 config，不硬编码。

### 4.3 Product Non-goals
- GUI 面板/浏览界面、写文档能力、集合浏览、GitLab CI/CD 集成、MCP 形态、多语言 UI。

## 5. Architecture / Runtime Boundary Baseline
### 5.1 Current Truth
- 形态：cordis bundle 包（package.json 声明 `dsh.bundle.patch`）+ `dsh.plugin.json`，host 侧插件，无 client 半。
- 工具注册：`inject: ['tools']` + `ctx.tools.register(defineTool(...))`；`@deepseek-ai/dsh-tools` 运行时从 DSH 安装内盒解析（profile 扁平 node_modules 回退）。
- 配置：Schemastery `Config` schema；`baseUrl`/`apiToken` 走 cordis row config；`apiToken` 支持环境变量 `OUTLINE_API_TOKEN` 覆盖。
- HTTP：Node 全局 fetch（host 侧可用）直连 Outline REST API（`POST /api/documents.search`、`POST /api/documents.info`，Bearer 认证）；fetch 可注入以便单测。
- 构建：TypeScript → tsc 输出 `lib/`；devDeps 优先 npm 发布包（`@deepseek-ai/dsh-tools@0.0.1-rc.1` 的 defineTool 核心 API 已核实与本机 rc.5 兼容），若类型漂移回退到指向本机 checkout 的 tsconfig paths。

### 5.2 Architecture Non-negotiables
1. 唯一 canonical owner：dsh-outline-kb 包；DSH 内部无新增 owner。
2. 依赖方向：插件 → dsh-tools / cordis / schemastery（向稳定方向）。
3. 客户端 HTTP 层与工具定义分离（client.ts 可注入 fetch，纯逻辑可测）。

### 5.3 Architecture Non-goals
- 不引入 MCP server 进程、不新增 DSH 服务、不改 DSH 组合层顺序（插入行即可）。

## 6. Ownership / Contract Snapshot
- 插件包 `dsh-outline-kb` → 新 owner（本项目）。
- 工具契约：`outline_search`（query/limit）、`outline_get_document`（id/maxLength）→ 见设计规格。
- DSH 侧无契约变更。

## 7. Current State and Risks
- 当前阶段：设计已获用户批准，正在写设计规格文档；实现未开始。
- 风险：内网实例不可达 → 真实验收由用户执行；npm devDeps 与 rc.5 潜在类型漂移（已核实核心 API 兼容，仍有残余风险）；Outline API 版本演进（以官方 OpenAPI 为准）。

## 8. Alignment Use
- 需求变更时读 §4；架构/契约变更时读 §5；两者都涉及时报告 `scope: both`。
- 实现期间每个非平凡变更后按 BASELINE-GOVERNANCE §5 做基线检查。

## 9. Compatibility Boundary
- 与已装插件（dsh-outline 大纲面板、dshmarket、aegis）互不影响。
- 不得破坏 web profile 现有 bundles 组合与运行中 GUI。
- 插件升级/卸载路径：`dsh plugin --profile web remove dsh-outline-kb`。
