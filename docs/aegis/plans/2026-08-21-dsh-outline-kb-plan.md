# dsh-outline-kb 实施计划

日期：2026-08-21
依据：`docs/aegis/specs/2026-08-21-dsh-outline-kb-design.md`（已批准）

## Goal

实现 DSH Web 插件 `dsh-outline-kb`（版本 0.1.0），注册两个 agent 工具 `outline_search` / `outline_get_document`，使 agent 能在对话中搜索并读取公司 Outline 知识库文档（Markdown）。构建、单测、Mock 冒烟、安装进 web profile 并验证组合成功；真实实例由用户在可达内网的机器上配置验收。

## Architecture

- cordis bundle 包：`package.json` 声明 `dsh.bundle.patch`，`cordis.patch.yml` insert 一行 `{id: outline-kb, name: 'dsh-outline-kb'}`。
- 插件入口 `src/index.ts`：`inject: ['tools']`，`apply(ctx, config)` 注册两个工具；配置缺失时不抛错（避免破坏 web profile 启动），工具被调用时才抛出明确的中文配置错误。
- `src/client.ts`：`OutlineClient`，封装 `POST /api/documents.search` 与 `POST /api/documents.info`，fetch 可注入（单测用），支持超时（AbortController）。
- `src/errors.ts`：`OutlineApiError` + HTTP 状态 → 中文错误映射。
- `src/tools.ts`：`defineTool` 定义两个工具（参数 schema、输出 schema、render、execute）。
- `src/config.ts`：Schemastery `Config`（baseUrl/apiToken 可选、timeoutMs/searchLimit 带默认值）。
- 测试：vitest（mock fetch）+ 本地 Mock Outline server 冒烟。

## Tech Stack

- TypeScript（strict），tsc 构建输出 `lib/`；源码内相对导入用 `.js` 扩展名（Node ESM 运行时正确性）。
- devDependencies（npm）：`@deepseek-ai/dsh-tools@0.0.1-rc.1`、`@deepseek-ai/cordis@4.0.1`、`@deepseek-ai/schemastery@3.18.1`、`typescript@^5.6.0`、`vitest@^4.1.8`、`@types/node@^24.0.0`。
- 运行时依赖（不安装，从 DSH 安装内盒解析）：`@deepseek-ai/dsh-tools`（rc.5）、`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`。
- 网络：pnpm/npm 通过本机代理 `http://127.0.0.1:7897`（环境变量 HTTPS_PROXY/HTTP_PROXY）。

## Baseline / Authority Refs

- 设计规格：`docs/aegis/specs/2026-08-21-dsh-outline-kb-design.md`
- DSH 文档：`docs/user/develop/basic/{tool,config,publish}.zh.md`
- DSH 源码：`packages/core/tools/src/schema.ts`（defineTool）、`packages/web/tool-web/src/search.ts`（参考）
- Outline OpenAPI：`spec3.yml`（documents.search / documents.info 契约已核实）

## Compatibility Boundary

- 不改 DSH 源码；新 bundle 插入一行，不影响既有 bundles（dsh-outline/dshmarket/aegis）。
- 插件在**未配置**时正常加载（工具调用时报错），不会破坏 web profile 启动。
- 卸载：`dsh plugin --profile web remove dsh-outline-kb`。
- 构建类型源：npm devDeps；若 rc 漂移导致 typecheck 失败，启用文档化的 `tsconfig.local.json` 回退（指向本机 DSH checkout 构建产物）。

## TDD Route

```text
TDD Route:
- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Test posture: post-change regression（vitest 单测 + Mock 冒烟在实现后编写并验证）
- Reason: 用户未要求 strict TDD；按最小实现 + 比例回归验证推进。
- Verification: pnpm typecheck / pnpm build / pnpm test / smoke / dump-config
```

## Verification（总览）

1. `pnpm typecheck` 0 错误
2. `pnpm build` 产出 `lib/index.js` + `.d.ts`
3. `pnpm test` 全绿
4. `node scripts/smoke.mjs` 输出 PASS（mock HTTP 端到端）
5. `dsh plugin --profile web add D:\deepseek\dsh-work\dsh-outline-kb` 成功；`dsh --profile web --dump-config` 含 `# == dsh-outline-kb` 层
6. git 提交历史完整

## File Map

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `package.json` | 新建 | 包清单 + dsh.bundle + scripts |
| `tsconfig.json` | 新建 | strict，ESNext，outDir lib |
| `vitest.config.ts` | 新建 | vitest 配置 |
| `cordis.patch.yml` | 新建 | insert 插件行 |
| `dsh.plugin.json` | 新建 | 插件清单（id/main/contributes） |
| `src/config.ts` | 新建 | Config 类型 + Schemastery schema |
| `src/errors.ts` | 新建 | OutlineApiError + 状态映射 |
| `src/client.ts` | 新建 | OutlineClient（fetch 可注入） |
| `src/tools.ts` | 新建 | 两个 defineTool |
| `src/index.ts` | 新建 | 插件入口 |
| `tests/client.spec.ts` | 新建 | 客户端单测（mock fetch） |
| `tests/tools.spec.ts` | 新建 | 工具定义/渲染单测 |
| `scripts/mock-outline-server.mjs` | 新建 | Mock Outline API |
| `scripts/smoke.mjs` | 新建 | 端到端冒烟 |
| `README.md` | 新建 | 安装/配置/验证指引 |
| `tsconfig.local.json` | 新建 | 类型漂移回退（文档化） |

## Tasks

### Task 0：包骨架与依赖

**Files**：`package.json`、`tsconfig.json`、`vitest.config.ts`、`pnpm-workspace.yaml`（空包声明）

**Why**：可安装/可构建的包基础。

**Steps**：

1. 创建 `package.json`（完整内容）：
```json
{
  "name": "dsh-outline-kb",
  "version": "0.1.0",
  "description": "DSH web plugin: search and read the company Outline knowledge base from conversations.",
  "type": "module",
  "license": "MIT",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib", "src", "cordis.patch.yml", "dsh.plugin.json", "README.md"],
  "engines": { "node": ">=22.13" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "smoke": "node scripts/smoke.mjs"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "4.0.1",
    "@deepseek-ai/dsh-tools": "0.0.1-rc.1",
    "@deepseek-ai/schemastery": "3.18.1",
    "@types/node": "^24.0.0",
    "typescript": "^5.6.0",
    "vitest": "^4.1.8"
  }
}
```
2. 创建 `tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "outDir": "lib",
    "rootDir": "src",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```
3. 创建 `vitest.config.ts`：
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { include: ['tests/**/*.spec.ts'] },
})
```
4. 创建 `pnpm-workspace.yaml`（内容仅一行）：
```yaml
packages: []
```
5. 安装依赖（需要代理环境变量；写入新位置需权限升级）：
```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7897"; $env:HTTP_PROXY = "http://127.0.0.1:7897"
pnpm install   # 通过 C:\Users\Administrator\.workbuddy\binaries\node\versions\24.14.0\pnpm.cmd 或 node pnpm.cjs
```
预期：`Done in …`，生成 `node_modules` 与 `pnpm-lock.yaml`。

**Verification**：`node_modules/@deepseek-ai/dsh-tools` 与 `node_modules/typescript` 存在。

### Task 1：`src/config.ts`

**Files**：`src/config.ts`

**Why**：配置契约（baseUrl/apiToken 可选、timeoutMs/searchLimit 默认值）。可选而非必填：避免未配置时插件加载失败破坏 web profile 启动（规格 §5 的细化）。

**Steps**：创建文件（完整内容）：
```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** Outline 实例根地址，如 https://outline.example.com（不含尾斜杠） */
  baseUrl?: string
  /** Outline API token（设置 → API 密钥）；环境变量 OUTLINE_API_TOKEN 优先 */
  apiToken?: string
  /** HTTP 请求超时（毫秒） */
  timeoutMs: number
  /** outline_search 默认返回条数 */
  searchLimit: number
}

export const Config: Schema<Config> = Schema.object({
  baseUrl: Schema.string().description('Outline 实例根地址，如 https://outline.example.com'),
  apiToken: Schema.string().description('Outline API token；环境变量 OUTLINE_API_TOKEN 优先'),
  timeoutMs: Schema.number().min(1000).default(15000).description('HTTP 请求超时（毫秒）'),
  searchLimit: Schema.number().min(1).max(25).default(10).description('outline_search 默认返回条数'),
})

// Context 仅为类型占位引用，保证与 cordis 的类型模型一致（供 HMR 与 schema 校验使用）。
export type { Context }
```

**Verification**：`pnpm typecheck` 无错误。

### Task 2：`src/errors.ts`

**Files**：`src/errors.ts`

**Why**：统一的错误类型与 HTTP 状态 → 中文错误映射（规格 §7）。

**Steps**：创建文件（完整内容）：
```ts
export type OutlineErrorKind = 'auth' | 'not-found' | 'rate-limited' | 'api' | 'network' | 'invalid-response'

export class OutlineApiError extends Error {
  readonly kind: OutlineErrorKind
  readonly status: number | null
  constructor(kind: OutlineErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'OutlineApiError'
    this.kind = kind
    this.status = status
  }
}

export function throwForStatus(status: number, bodyText: string): never {
  const detail = bodyText.slice(0, 200)
  switch (status) {
    case 401:
    case 403:
      throw new OutlineApiError('auth', `Outline API 认证失败（HTTP ${status}）：请检查 apiToken 是否有效且有权访问。响应：${detail}`, status)
    case 404:
      throw new OutlineApiError('not-found', 'Outline 文档不存在或无权访问（HTTP 404）：请确认文档 id 是否正确。', status)
    case 429:
      throw new OutlineApiError('rate-limited', 'Outline API 触发限流（HTTP 429）：请稍后重试。', status)
    default:
      throw new OutlineApiError('api', `Outline API 请求失败（HTTP ${status}）：${detail}`, status)
  }
}
```

**Verification**：`pnpm typecheck`。

### Task 3：`src/client.ts`

**Files**：`src/client.ts`

**Why**：Outline REST 客户端（纯逻辑，fetch 可注入）。

**Steps**：创建文件（完整内容）：
```ts
import { OutlineApiError, throwForStatus } from './errors.js'

export interface OutlineSearchHit {
  id: string
  title: string
  url: string
  snippet: string
  collectionId: string
  updatedAt: string
}

export interface OutlineDocument {
  id: string
  title: string
  url: string
  text: string
  updatedAt: string
}

export interface OutlineClientOptions {
  baseUrl: string
  apiToken: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class OutlineClient {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly baseUrl: string

  constructor(options: OutlineClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 15000
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError'
      const cause = error instanceof Error ? error.message : String(error)
      throw new OutlineApiError(
        'network',
        aborted
          ? `Outline 请求超时（${this.timeoutMs}ms）：${url}`
          : `无法连接 Outline（${url}）：${cause}。请确认 baseUrl 正确且网络可达。`,
      )
    } finally {
      clearTimeout(timer)
    }
    const bodyText = await response.text().catch(() => '')
    if (!response.ok) throwForStatus(response.status, bodyText)
    let json: unknown
    try {
      json = JSON.parse(bodyText)
    } catch {
      throw new OutlineApiError('invalid-response', 'Outline 返回了无法解析的响应。')
    }
    const data = (json as { data?: unknown }).data
    if (data === undefined) throw new OutlineApiError('invalid-response', 'Outline 响应缺少 data 字段。')
    return data as T
  }

  async searchDocuments(query: string, limit: number): Promise<OutlineSearchHit[]> {
    const data = await this.request<unknown[]>(`/api/documents.search`, { query, limit })
    return data.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>
      const document = (record.document ?? {}) as Record<string, unknown>
      return {
        id: typeof document.id === 'string' ? document.id : '',
        title: typeof document.title === 'string' ? document.title : '(无标题)',
        url: typeof document.url === 'string' ? document.url : '',
        snippet: typeof record.context === 'string' ? record.context : '',
        collectionId: typeof document.collectionId === 'string' ? document.collectionId : '',
        updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : '',
      }
    })
  }

  async getDocument(id: string): Promise<OutlineDocument> {
    const data = await this.request<Record<string, unknown>>(`/api/documents.info`, { id })
    return {
      id: typeof data.id === 'string' ? data.id : id,
      title: typeof data.title === 'string' ? data.title : '(无标题)',
      url: typeof data.url === 'string' ? data.url : '',
      text: typeof data.text === 'string' ? data.text : '',
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    }
  }
}
```
注意：`private readonly options` 未声明 —— 改为字段或直接使用构造参数。**修正**：将 `constructor(private readonly options: OutlineClientOptions)` 与上文 `this.baseUrl` 等字段一致（options 作为普通构造参数即可，`apiToken` 在 request 中通过 `this.baseUrl` 外的字段引用——见下）：
```ts
export class OutlineClient {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly baseUrl: string
  private readonly apiToken: string
  constructor(options: OutlineClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiToken = options.apiToken
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 15000
  }
  // request() 中 Authorization 使用 this.apiToken
}
```
（实现时以修正版为准：字段全部显式声明，无 `options` 残留。）

**Verification**：`pnpm typecheck`。

### Task 4：`src/tools.ts`

**Files**：`src/tools.ts`

**Why**：两个工具定义（规格 §4）。

**Steps**：创建文件（完整内容）：
```ts
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { OutlineClient, OutlineSearchHit, OutlineDocument } from './client.js'

export const SEARCH_MAX_LIMIT = 25
export const DOCUMENT_DEFAULT_MAX_LENGTH = 20000
export const DOCUMENT_MAX_LENGTH_CAP = 200000

function renderSearchResults(hits: OutlineSearchHit[]): string {
  if (hits.length === 0) return '未找到匹配文档，可尝试更换关键词。'
  const lines = hits.map((hit) => {
    const meta = hit.snippet.length > 0 ? ` — ${hit.snippet}` : ''
    return `- [${hit.title}](${hit.url})${meta}（id: ${hit.id}）`
  })
  return `找到 ${hits.length} 篇文档：\n${lines.join('\n')}\n\n如需查看某篇全文，请使用 outline_get_document 工具（参数 id）。`
}

function renderDocument(doc: OutlineDocument, truncated: boolean): string {
  const note = truncated ? '\n\n…（内容过长已截断，可增大 maxLength 参数）' : ''
  return `# ${doc.title}\n\n${doc.url}\n\n${doc.text}${note}`
}

export function outlineSearchTool(makeClient: () => OutlineClient, defaultLimit: number) {
  return defineTool({
    name: 'outline_search',
    description: '在 Outline 知识库中按关键词搜索文档，返回标题、命中片段、文档 id 与链接。结果受当前 API token 的访问权限限制。',
    parameters: {
      query: { type: 'string', required: true, description: '搜索关键词' },
      limit: { type: 'integer', required: false, description: `返回结果条数（默认 ${defaultLimit}，最大 ${SEARCH_MAX_LIMIT}）` },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
            collectionId: { type: 'string' },
            updatedAt: { type: 'string' },
          },
          required: ['id', 'title'],
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderSearchResults(value) }],
    },
    async execute(args) {
      const limit = Math.min(SEARCH_MAX_LIMIT, Math.max(1, args.limit ?? defaultLimit))
      const client = makeClient()
      return client.searchDocuments(args.query, limit)
    },
  })
}

export function outlineGetDocumentTool(makeClient: () => OutlineClient) {
  return defineTool({
    name: 'outline_get_document',
    description: '按文档 id（来自 outline_search 的结果或 Outline 的 urlId）获取文档完整内容（Markdown 格式）。',
    parameters: {
      id: { type: 'string', required: true, description: '文档 UUID 或 urlId' },
      maxLength: { type: 'integer', required: false, description: '返回内容最大字符数（默认 20000，最小 1000，最大 200000），超出截断' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          text: { type: 'string' },
          truncated: { type: 'boolean' },
          updatedAt: { type: 'string' },
        },
        required: ['id', 'title', 'text', 'truncated'],
      },
      render: (_args, value) => [{ type: 'text', text: renderDocument(value, value.truncated) }],
    },
    async execute(args) {
      const maxLength = Math.min(DOCUMENT_MAX_LENGTH_CAP, Math.max(1000, args.maxLength ?? DOCUMENT_DEFAULT_MAX_LENGTH))
      const doc = await makeClient().getDocument(args.id)
      const truncated = doc.text.length > maxLength
      return { ...doc, text: truncated ? doc.text.slice(0, maxLength) : doc.text, truncated }
    },
  })
}
```

**Verification**：`pnpm typecheck`。

### Task 5：`src/index.ts` + 清单文件

**Files**：`src/index.ts`、`cordis.patch.yml`、`dsh.plugin.json`

**Why**：插件入口与安装清单（规格 §3）。

**Steps**：

1. `src/index.ts`（完整内容）：
```ts
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import { OutlineClient } from './client.js'
import { outlineSearchTool, outlineGetDocumentTool } from './tools.js'

export const name = 'dsh-outline-kb'
export const inject = ['tools']

export function apply(ctx: Context, config: Config) {
  const makeClient = () => {
    const baseUrl = (config.baseUrl ?? '').trim() || (process.env.OUTLINE_BASE_URL ?? '').trim()
    const apiToken = (process.env.OUTLINE_API_TOKEN ?? '').trim() || (config.apiToken ?? '').trim()
    if (!baseUrl || !apiToken) {
      throw new Error(
        'dsh-outline-kb 未配置：需要 baseUrl（插件行 config.baseUrl 或环境变量 OUTLINE_BASE_URL）与 apiToken（环境变量 OUTLINE_API_TOKEN 或 config.apiToken）。配置方法见插件 README。',
      )
    }
    return new OutlineClient({ baseUrl, apiToken, timeoutMs: config.timeoutMs })
  }
  ctx.tools.register(outlineSearchTool(makeClient, config.searchLimit))
  ctx.tools.register(outlineGetDocumentTool(makeClient))
}
```
2. `cordis.patch.yml`（完整内容）：
```yaml
- insert:
    - id: outline-kb
      name: 'dsh-outline-kb'
```
3. `dsh.plugin.json`（完整内容）：
```json
{
  "id": "dsh-external/dsh-outline-kb",
  "version": "0.1.0",
  "main": "./lib/index.js",
  "description": "在 DSH 对话中搜索并读取 Outline 知识库文档（outline_search / outline_get_document）",
  "engines": { "dsh": ">=0.0.1" },
  "contributes": { "tools": ["outline_search", "outline_get_document"], "skills": [] }
}
```

**Verification**：`pnpm typecheck`；`node -e "import('./lib/index.js').then(m => console.log(m.name, m.inject))"`（build 后）输出 `dsh-outline-kb ['tools']`。

### Task 6：单元测试

**Files**：`tests/client.spec.ts`、`tests/tools.spec.ts`

**Why**：规格 §8 验证策略第 1 条（mock fetch 单测）。

**Steps**：

1. `tests/client.spec.ts`（完整内容）：
```ts
import { describe, it, expect } from 'vitest'
import { OutlineClient } from '../src/client.js'
import { OutlineApiError } from '../src/errors.js'

type StubResponse = { status: number; body: unknown }

function stubFetch(handler: (url: string, init: RequestInit) => Promise<StubResponse>): typeof fetch {
  return (async (url: any, init: any) => {
    const r = await handler(String(url), init as RequestInit)
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => JSON.stringify(r.body),
    } as unknown as Response
  }) as typeof fetch
}

const SEARCH_BODY = {
  data: [
    {
      context: '部署规范相关片段',
      document: { id: 'doc-1', title: '部署规范', url: '/doc/deploy', collectionId: 'col-1', updatedAt: '2026-01-01T00:00:00Z' },
    },
  ],
  pagination: {},
}

const INFO_BODY = {
  data: { id: 'doc-1', title: '部署规范', url: '/doc/deploy', text: '# 部署\n\n步骤…', updatedAt: '2026-01-01T00:00:00Z' },
}

describe('OutlineClient', () => {
  it('searchDocuments 解析 data[].document 并保留 context 片段', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com/',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (url, init) => {
        expect(url).toBe('https://outline.example.com/api/documents.search')
        expect(init.method).toBe('POST')
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
        expect(JSON.parse(String(init.body))).toEqual({ query: '部署', limit: 5 })
        return { status: 200, body: SEARCH_BODY }
      }),
    })
    const hits = await client.searchDocuments('部署', 5)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ id: 'doc-1', title: '部署规范', snippet: '部署规范相关片段' })
  })

  it('searchDocuments 空结果返回空数组', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: { data: [] } })),
    })
    expect(await client.searchDocuments('xyz', 10)).toEqual([])
  })

  it('getDocument 返回 Markdown 全文', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: INFO_BODY })),
    })
    const doc = await client.getDocument('doc-1')
    expect(doc).toMatchObject({ id: 'doc-1', title: '部署规范', text: '# 部署\n\n步骤…' })
  })

  it('401 映射为 auth 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 401, body: { ok: false } })),
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'auth' })
  })

  it('404 映射为 not-found 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 404, body: {} })),
    })
    await expect(client.getDocument('nope')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('429 映射为 rate-limited 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 429, body: {} })),
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'rate-limited' })
  })

  it('网络失败映射为 network 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: (async () => { throw new TypeError('fetch failed') }) as typeof fetch,
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'network' })
  })

  it('响应缺 data 字段抛 invalid-response', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: { nope: 1 } })),
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('OutlineApiError 是 Error 实例', () => {
    const err = new OutlineApiError('network', 'boom')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('boom')
  })
})
```
2. `tests/tools.spec.ts`（完整内容）：
```ts
import { describe, it, expect } from 'vitest'
import { outlineSearchTool, outlineGetDocumentTool } from '../src/tools.js'
import { OutlineApiError } from '../src/errors.js'
import type { OutlineClient } from '../src/client.js'

function fakeClient(overrides: Partial<OutlineClient> = {}): OutlineClient {
  return {
    searchDocuments: async (query: string) => [{ id: 'doc-1', title: query, url: '/d', snippet: 's', collectionId: '', updatedAt: '' }],
    getDocument: async (id: string) => ({ id, title: 'T', url: '/d', text: 'body', updatedAt: '' }),
    ...overrides,
  } as unknown as OutlineClient
}

const exec = {} as never

describe('outline_search', () => {
  it('execute 返回归一化结果并截断 limit', async () => {
    const tool = outlineSearchTool(() => fakeClient(), 10)
    const result = await tool.execute({ query: '部署' }, exec)
    expect(result).toHaveLength(1)
    expect((result as any)[0].id).toBe('doc-1')
  })

  it('limit 超界被钳制', async () => {
    let seen = 0
    const tool = outlineSearchTool(() => fakeClient({ searchDocuments: async (_q, limit) => { seen = limit; return [] } }), 10)
    await tool.execute({ query: 'x', limit: 999 }, exec)
    expect(seen).toBe(25)
  })

  it('未配置时抛出中文配置错误', async () => {
    const tool = outlineSearchTool(() => { throw new Error('dsh-outline-kb 未配置：…') }, 10)
    await expect(tool.execute({ query: 'x' }, exec)).rejects.toThrow('未配置')
  })
})

describe('outline_get_document', () => {
  it('execute 返回全文并按 maxLength 截断', async () => {
    const tool = outlineGetDocumentTool(() => fakeClient({ getDocument: async () => ({ id: 'd', title: 'T', url: '/d', text: 'a'.repeat(3000), updatedAt: '' }) }))
    const result = await tool.execute({ id: 'd', maxLength: 1000 }, exec) as any
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(1000)
  })

  it('文档缺失透传 not-found 错误', async () => {
    const tool = outlineGetDocumentTool(() => fakeClient({ getDocument: async () => { throw new OutlineApiError('not-found', 'Outline 文档不存在或无权访问（HTTP 404）：请确认文档 id 是否正确。', 404) } }))
    await expect(tool.execute({ id: 'nope' }, exec)).rejects.toMatchObject({ kind: 'not-found' })
  })
})
```

**Verification**：`pnpm test` 全绿。

### Task 7：Mock server + 冒烟

**Files**：`scripts/mock-outline-server.mjs`、`scripts/smoke.mjs`

**Why**：规格 §8 第 3 条——内网不可达时用本地 Mock 做真实 HTTP 端到端验证；smoke 脚本同时是用户在真实实例上的自检工具。

**Steps**：

1. `scripts/mock-outline-server.mjs`（完整内容）：
```js
import http from 'node:http'

const DOCS = [
  { id: 'doc-1', title: '部署规范', url: '/doc/deploy', collectionId: 'col-1', updatedAt: '2026-01-01T00:00:00Z', text: '# 部署规范\n\n## 环境\n\n- 生产：prod.example.com\n\n## 步骤\n\n1. 构建\n2. 推送镜像\n3. 发布' },
  { id: 'doc-2', title: '代码评审规范', url: '/doc/review', collectionId: 'col-1', updatedAt: '2026-02-01T00:00:00Z', text: '# 代码评审规范\n\n评审人需在 24 小时内完成评审。' },
  { id: 'doc-3', title: '新员工入职指南', url: '/doc/onboarding', collectionId: 'col-2', updatedAt: '2026-03-01T00:00:00Z', text: '# 新员工入职指南\n\n欢迎加入！' },
]

export function createMockOutlineServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405); res.end('{"error":"method not allowed"}'); return }
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      const auth = req.headers.authorization ?? ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (token === 'invalid') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"authentication_required"}'); return }
      let parsed = {}
      try { parsed = JSON.parse(body || '{}') } catch { /* ignore */ }
      const send = (status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)) }
      if (req.url === '/api/documents.search') {
        const query = String(parsed.query ?? '').toLowerCase()
        const limit = Number(parsed.limit ?? 10)
        const hits = DOCS
          .filter((doc) => doc.title.toLowerCase().includes(query) || doc.text.toLowerCase().includes(query))
          .slice(0, limit)
          .map((doc) => ({ context: doc.text.slice(0, 40), document: { id: doc.id, title: doc.title, url: doc.url, collectionId: doc.collectionId, updatedAt: doc.updatedAt } }))
        send(200, { data: hits, pagination: {} })
        return
      }
      if (req.url === '/api/documents.info') {
        const doc = DOCS.find((d) => d.id === parsed.id)
        if (!doc) { send(404, { ok: false, error: 'not_found' }); return }
        send(200, { data: { id: doc.id, title: doc.title, url: doc.url, text: doc.text, updatedAt: doc.updatedAt } })
        return
      }
      send(404, { ok: false, error: 'not_found' })
    })
  })
}
```
2. `scripts/smoke.mjs`（完整内容）：
```js
import { createMockOutlineServer } from './mock-outline-server.mjs'
import { apply } from '../lib/index.js'

const server = createMockOutlineServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const baseUrl = `http://127.0.0.1:${port}`

const tools = []
const ctx = { tools: { register: (definition) => { tools.push(definition) } } }
apply(ctx, { baseUrl, apiToken: 'test-token', timeoutMs: 5000, searchLimit: 5 })
const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
const exec = {}
let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) failures++ }

try {
  const hits = await byName.outline_search.execute({ query: '部署', limit: 3 }, exec)
  check('outline_search 返回结果', Array.isArray(hits) && hits.length === 1 && hits[0].id === 'doc-1', JSON.stringify(hits))
  const empty = await byName.outline_search.execute({ query: '不存在的词', limit: 3 }, exec)
  check('outline_search 空结果', Array.isArray(empty) && empty.length === 0)
  const doc = await byName.outline_get_document.execute({ id: 'doc-1' }, exec)
  check('outline_get_document 全文', typeof doc.text === 'string' && doc.text.includes('# 部署规范'))
  const trunc = await byName.outline_get_document.execute({ id: 'doc-1', maxLength: 1000 }, exec)
  check('outline_get_document 截断', trunc.truncated === false || trunc.text.length <= 1000)
  let notFound = false
  try { await byName.outline_get_document.execute({ id: 'missing' }, exec) } catch (e) { notFound = e.kind === 'not-found' }
  check('outline_get_document 404', notFound)
} catch (error) {
  console.error('SMOKE ERROR:', error)
  failures++
}

await new Promise((resolve) => server.close(resolve))
if (failures > 0) { console.error(`SMOKE FAILED (${failures})`); process.exit(1) }
console.log('SMOKE PASS')
```

**Verification**：`pnpm build` 后 `node scripts/smoke.mjs` 输出 `SMOKE PASS`。

### Task 8：构建与测试全绿

**Files**：无（验证任务）

**Steps**（workdir = `D:\deepseek\dsh-work\dsh-outline-kb`，写入需权限升级）：
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. `node scripts/smoke.mjs`

**Verification**：四步均成功；`lib/index.js`、`lib/index.d.ts` 存在。

### Task 9：安装进 web profile 并验证组合

**Files**：`C:\Users\Administrator\.dsh\profiles\web\package.json`（由 CLI 更新）、`~/.dsh/profiles/web/pnpm-lock.yaml`、`~/.dsh/profiles/web/node_modules/dsh-outline-kb`（链接）

**Why**：交付到运行中的 DSH web profile（规格 §8 第 4 条）。

**Steps**（需要权限升级；代理环境变量）：
```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7897"; $env:HTTP_PROXY = "http://127.0.0.1:7897"
node D:\deepseek\deepseek-harness-master\apps\cli\lib\bin.js plugin --profile web add D:\deepseek\dsh-work\dsh-outline-kb
node D:\deepseek\deepseek-harness-master\apps\cli\lib\bin.js --profile web --dump-config
```
**Verification**：第一条命令输出 `+ dsh-outline-kb`；第二条输出含 `# == dsh-outline-kb` 与 `- id: outline-kb  name: dsh-outline-kb`；profile package.json 的 bundles 含 `"dsh-outline-kb"`。

**注意**：安装后运行中的 GUI 需重启才加载插件（与已装 dsh-outline 相同）；本机不可达内网实例，用户在公司机器配置真实 baseUrl/apiToken 后重启 GUI 验收。

### Task 10：README + 提交

**Files**：`README.md`、`.gitignore`、`docs/aegis/INDEX.md`

**Steps**：

1. `.gitignore`：`node_modules/`、`lib/`、`*.log`。
2. `README.md`（要点）：插件说明、安装（`dsh plugin --profile web add <path>`）、配置（profile `cordis.patch.yml` 覆盖示例，含 env 变量说明）、工具说明、Mock 冒烟、真实实例验收、卸载、常见问题（与 CI/CD 工作流关系说明）。
3. 更新 `docs/aegis/INDEX.md` 追加 plan 条目。
4. git 提交（`git add -A && git commit`），提交信息：`feat: dsh-outline-kb 插件实现（工具/配置/单测/冒烟/安装）`。

**Verification**：`git log --oneline` 展示完整提交链；`git status` clean。

## Risks

| 风险 | 缓解 |
| --- | --- |
| npm `@deepseek-ai/*` 依赖树在 npm 上不完整（dsh-type-meta 等 404），无法用 npm devDeps 构建 | **实现落地方案**：devDeps 仅保留 typescript/vitest/@types/node；`@deepseek-ai/*` 通过插件 `node_modules/@deepseek-ai` junction 指向 `~/.dsh/profiles/node_modules/@deepseek-ai`（DSH 维护的扁平目录，绝对路径链接）解析，与运行时内盒包一致；README 记录了其它机器上的复现步骤（原计划中的 tsconfig.local.json 方案被此方案取代） |
| 未配置时破坏 web profile 启动 | 设计细化：config 字段可选，工具调用时才报配置错误（Task 1/5） |
| 内网实例不可达，本机无法真实验收 | Mock server + smoke；用户在公司机器配置后验收（README 指引） |
| Outline API 字段变化 | 只依赖 OpenAPI 稳定字段；客户端容错（缺字段用空串） |
| 会话工作区已迁移（旧路径失效） | 文件写入与构建命令按需权限升级；项目物理位于 `D:\deepseek\dsh-work\dsh-outline-kb` |

## Retirement

- 卸载：`dsh plugin --profile web remove dsh-outline-kb`（移除依赖与 bundles 层）。
- 无旧 owner/fallback 需要清理（全新插件）。
- 若未来接入 MCP 或其他形态，本插件可作为独立包保留或归档，不产生兼容承诺。

## Execution Readiness View

```text
Execution Readiness View:
- Intent Lock: 交付 dsh-outline-kb 插件（outline_search / outline_get_document），构建+单测+冒烟+安装验证；真实实例由用户验收。
- Scope Fence: 规格 §2 非目标（GUI/写文档/集合浏览/CI 集成/MCP）不实现。
- Baseline Lock: 设计规格（已批准）；DSH 工具/配置/发布约定；Outline OpenAPI 契约。
- Approved Behavior: 规格 §4 工具契约与 §5 配置；错误映射 §7。
- Owner / Contract Constraints: 不改 DSH 源码；config 可选 + 调用时报错（防破坏启动）；token 走 env。
- Compatibility Boundary: 与已装插件共存；卸载路径明确；npm devDeps + 本地回退。
- Retirement Boundary: remove 命令即可。
- Task Batches: 0-5（骨架/源码）→ 6-7（测试/冒烟）→ 8（全绿）→ 9（安装）→ 10（文档/提交）。
- Test Obligations: typecheck/build/test/smoke/dump-config 全绿。
- Review Gates: 用户对规格已批准；计划执行中若偏离规格需回停说明。
- Drift / Rewind Rules: 任何偏离规格的行为变更先与用户确认；失败任务可整体回退（新 bundle，无残留）。
- Evidence Required Before Completion: Task 8 四步 + Task 9 dump-config 输出 + git 提交链。
- Advisory Boundary: 方法包执行指引，非完成授权。
```
