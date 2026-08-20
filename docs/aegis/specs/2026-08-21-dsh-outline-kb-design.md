# dsh-outline-kb 设计规格（Design Spec）

日期：2026-08-21
状态：已获用户设计评审批准（方案 A）
类型：greenfield 插件设计

## 1. 背景与目标

公司文档工作流：本地 Markdown 编写 → CI/CD 推到 GitLab → 同步进 Outline 知识库。
用户在 DSH Web GUI 中工作时，需要在不离开对话的情况下检索/阅读 Outline 中的文档。

**目标**：交付一个 DSH Web 插件 `dsh-outline-kb`，注册两个 agent 工具，使 agent 能在对话中搜索 Outline 文档并读取全文 Markdown。

**与已装 `dsh-outline` 的区别**：`dsh-outline` 是会话大纲面板（聊天记录标题树），与 Outline 知识库无关；`dsh-outline-kb` 对接 Outline 知识库 API。两者名字刻意区分，互不影响。

## 2. 范围

### 范围内
- `outline_search`：关键词搜索 Outline 文档，返回标题 + 命中片段 + url + id + 集合信息。
- `outline_get_document`：按 id 获取文档全文（Markdown），支持长度截断。
- 可配置 `baseUrl` / `apiToken`（apiToken 支持环境变量覆盖）。
- 友好的错误信息（401/403/404/429/网络错误，中文提示）。
- vitest 单测 + 本地 Mock Outline server + 安装/组合验证。
- README（安装、配置、验证、与公司 CI/CD 工作流的关系）。

### 非目标（本轮明确不做）
- GUI 面板 / 浏览界面；文档 create/update/delete；集合浏览工具；GitLab CI/CD 集成；MCP 形态；多语言 UI。

## 3. 包结构与架构

```
dsh-outline-kb/
├── package.json            # name: dsh-outline-kb, type: module, main: lib/index.js,
│                           #   dsh.bundle.patch → ./cordis.patch.yml, files: [lib, src, ...]
├── cordis.patch.yml        # - insert: [{ id: outline-kb, name: 'dsh-outline-kb' }]
├── dsh.plugin.json         # id: dsh-external/dsh-outline-kb, main: ./lib/index.js,
│                           #   contributes.tools: []（空，工具经 cordis 注册）, client: 无
├── tsconfig.json           # strict, module: ESNext, outDir: lib, declaration
├── src/
│   ├── index.ts            # export name='dsh-outline-kb', inject=['tools'], apply(ctx, config)
│   │                       #   → 解析配置 → new OutlineClient(...) → 注册两个工具
│   ├── config.ts           # Config interface + Schemastery schema（含默认值与 required）
│   ├── client.ts           # OutlineClient：searchDocuments()/getDocument()，fetch 可注入
│   ├── errors.ts           # OutlineApiError（status/类型）→ 友好中文消息映射
│   └── tools.ts            # defineTool 定义：参数 schema、output schema、render、execute
├── tests/
│   ├── client.spec.ts      # mock fetch：search/info/错误分支
│   └── tools.spec.ts       # 工具定义与参数校验
├── scripts/
│   └── mock-outline-server.mjs  # 本地 Mock Outline API（fixtures JSON）
└── README.md
```

**分层原则**（参考 dsh-outline AGENTS.md 架构纪律）：
- `client.ts`/`errors.ts`：纯逻辑，不 import DSH API；`fetch` 由 `apply` 注入（默认全局 fetch），单测可替换。
- `tools.ts`/`index.ts`：DSH 适配层，只在这里 import `@deepseek-ai/dsh-tools` / `@deepseek-ai/cordis`。

## 4. 工具契约

### 4.1 `outline_search`

- **name**: `outline_search`
- **description**: 在 Outline 知识库中按关键词搜索文档，返回标题、命中片段、文档 id 与链接。结果受当前 API token 的访问权限限制。
- **parameters**:
  - `query` (string, required)：搜索关键词。
  - `limit` (integer, optional, default 10, min 1, max 25)：返回结果条数。
- **实现**：`POST {baseUrl}/api/documents.search`，body `{ query, limit }`（limit 同时传给 API）。
- **输出 canonical value**（output.schema）：
  ```json
  {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "url": { "type": "string" },
        "snippet": { "type": "string" },
        "collectionId": { "type": ["string", "null"] },
        "updatedAt": { "type": ["string", "null"] }
      },
      "required": ["id", "title"]
    }
  }
  ```
- **render**：Markdown 列表，每条 `- [标题](url) — 片段`，附 `id`（提示 agent 用 `outline_get_document` 取全文）；无结果显示 `未找到匹配文档，可尝试更换关键词。`

### 4.2 `outline_get_document`

- **name**: `outline_get_document`
- **description**: 按文档 id（来自 outline_search 或 Outline urlId）获取文档完整内容（Markdown 格式）。
- **parameters**:
  - `id` (string, required)：文档 UUID 或 urlId。
  - `maxLength` (integer, optional, default 20000, min 1000, max 200000)：返回内容的最大字符数，超出截断。
- **实现**：`POST {baseUrl}/api/documents.info`，body `{ id }`。
- **输出 canonical value**：
  ```json
  {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "title": { "type": "string" },
      "url": { "type": "string" },
      "text": { "type": "string" },
      "truncated": { "type": "boolean" },
      "updatedAt": { "type": ["string", "null"] }
    },
    "required": ["id", "title", "text", "truncated"]
  }
  ```
- **render**：`# 标题\n\n<url>\n\n<正文 Markdown>`；截断时末尾追加 `\n\n…（内容过长已截断至 maxLength 字符，可增大 maxLength 参数）`。

## 5. 配置与安全

Schemastery Config schema：

```ts
interface Config {
  baseUrl: string      // 必填，如 https://outline.example.com（不含尾斜杠）
  apiToken: string     // 必填（可被环境变量覆盖），Outline 设置→API 密钥
  timeoutMs: number    // 默认 15000，HTTP 超时
  searchLimit: number  // 默认 10，上限 25（outline_search 的默认 limit）
}
```

- 配置来自 cordis row config（`cordis.patch.yml` / profile 覆盖层）。
- `apiToken` 解析顺序：环境变量 `OUTLINE_API_TOKEN` > config.apiToken。环境变量优先，避免密钥进 git。
- token 仅用于 `Authorization: Bearer <token>` 请求头；不记录日志。
- schema 校验失败在插件加载时响亮失败（符合 DSH 配置约定）。

## 6. 数据流

```
agent 调用 outline_search
  → defineTool 参数校验
  → OutlineClient.searchDocuments(query, limit)   [fetch 注入]
  → POST {baseUrl}/api/documents.search (Authorization: Bearer)
  → 200 { data: [{ context, document }] } → 归一化 {id,title,url,snippet,collectionId,updatedAt}
  → output.schema 校验 → render → agent 可见结果

agent 调用 outline_get_document
  → OutlineClient.getDocument(id)                 [fetch 注入]
  → POST {baseUrl}/api/documents.info {id}
  → 200 { data: Document } → text(Markdown) → 按 maxLength 截断
  → output.schema 校验 → render → agent 可见结果
```

## 7. 错误处理

| 情况 | 行为 |
| --- | --- |
| HTTP 401/403 | 抛错：`Outline API 认证失败（{status}）：请检查 apiToken 是否有效/有权限` |
| HTTP 404 | 抛错：`文档不存在或无权访问（404）：请确认 id 是否正确` |
| HTTP 429 | 抛错：`Outline API 限流（429）：请稍后重试` |
| 其他非 2xx | 抛错：`Outline API 请求失败（{status}）：{响应体摘要}` |
| 网络错误/超时 | 抛错：`无法连接 Outline（{baseUrl}）：{错误}。请确认 baseUrl 正确且网络可达` |
| JSON 解析失败 | 抛错：`Outline 返回了无法解析的响应` |

错误信息为中文，直接作为工具执行异常返回给 agent。

## 8. 验证策略（内网实例不可达的应对）

1. **vitest 单测**：mock fetch 覆盖 search 成功/空结果、info 成功/截断、401/403/404/429/网络错误、参数校验。
2. **typecheck + build**：tsc 严格模式。
3. **Mock Outline server 冒烟**：`scripts/mock-outline-server.mjs` 起本地服务，用冒烟脚本直接调用工具 execute，端到端验证请求构造/响应解析。
4. **安装验证**：`dsh plugin --profile web add <path>` 后 `dsh --profile web --dump-config` 组合成功且含 outline-kb 层。
5. **用户真实验收**：公司内网机器配置真实 baseUrl/apiToken，重启 GUI 后对话中调用两个工具验证。

## 9. 兼容性边界

- 不改 DSH 源码；插件为独立 bundle，插入一行即可，不影响既有 bundles 组合。
- 与已装插件（dsh-outline 大纲面板、dshmarket、aegis）无冲突。
- 卸载：`dsh plugin --profile web remove dsh-outline-kb`。
- 构建依赖：devDeps 用 npm 发布包（`@deepseek-ai/dsh-tools@0.0.1-rc.1`、`@deepseek-ai/cordis@4.0.1`、`@deepseek-ai/schemastery@3.18.1`），运行时从 DSH 安装内盒解析（rc.5）。已核实 defineTool 核心 API 兼容；若类型漂移导致构建失败，回退为 tsconfig paths 指向本机 DSH checkout。

## 10. 验收标准（可观察）

1. `pnpm typecheck` 与 `pnpm build` 通过，产出 `lib/index.js`。
2. `pnpm test` 全绿（mock fetch 单测）。
3. Mock server 冒烟：`outline_search` 返回 fixture 结果、`outline_get_document` 返回 fixture Markdown、错误分支正确。
4. `dsh plugin --profile web add ./dsh-outline-kb` 成功；`dsh --profile web --dump-config` 输出含 `# == dsh-outline-kb` 层。
5. 用户在公司内网配置真实实例后，两个工具可用（用户验收，交付时给出 README 指引）。

## 11. 风险与回退

| 风险 | 缓解 |
| --- | --- |
| 内网实例不可达，无法本机真实验收 | Mock + 明确验收指引；交付点以用户确认为准 |
| npm devDeps 与 rc.5 类型漂移 | 已核实核心 API；回退 tsconfig paths |
| Outline API 版本演进 | 以官方 OpenAPI spec3.yml 为准；实现只依赖稳定字段 |
| token 泄露 | env 优先、不进 git、不写日志 |

## 12. 附录：Working Artifacts

### TaskIntentDraft
- Outcome：DSH 插件 dsh-outline-kb，对话内可搜索/读取公司 Outline 知识库文档。
- Success evidence：见 §10 验收标准 1–4 由本机完成，5 由用户验收。
- Stop condition：用户真实实例验收通过，或用户确认以 Mock+指引为交付点。
- Non-goals：见 §2。
- Risks：见 §11。

### BaselineReadSetHint
- DSH 文档：`docs/user/develop/basic/{tool,config,publish}.zh.md`（已读）
- DSH 源码：`packages/core/tools/src/schema.ts`（defineTool，已读）；`packages/web/tool-web/src/search.ts`（参考，已读）
- Outline OpenAPI：`spec3.yml`（已下载核实 search/info 契约）
- 插件约定：dsh-outline 仓库 AGENTS.md / dsh.plugin.json（已读）
- 权威缺口：无

### BaselineUsageDraft
- Required baseline refs：上述 DSH 文档 + defineTool + Outline OpenAPI
- Delivered context refs：本会话已读/下载（同上）
- Acknowledged before plan refs：同上
- Cited in design refs：§3–§9
- Missing refs：无
- Decision：continue

### ImpactStatementDraft
- Affected layers：web profile（新增 bundle 依赖与层）、DSH 工具注册表（新增 2 工具）；DSH 源码零改动
- Owners：新 owner dsh-outline-kb（本插件）；DSH 内部 owner 无变更
- Invariants：不改 DSH 源码；只读不写 Outline；token 不进 git
- Compat：与已装插件互不影响；npm devDeps 与 rc.5 兼容（已核实）
- Non-goals：见 §2
