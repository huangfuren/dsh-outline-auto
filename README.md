# dsh-outline-kb

DSH（DeepSeek Harness）Web 插件：在对话中**搜索并读取公司 Outline 知识库**文档。

配合你们的文档工作流：**本地 Markdown → CI/CD → GitLab → 同步 Outline**。本插件只读 Outline，不修改文档源，也不参与同步流程。

## 功能

| 工具 | 说明 |
| --- | --- |
| `outline_search(query, limit?)` | 按关键词搜索文档，返回标题、命中片段、文档 id 与链接 |
| `outline_get_document(id, maxLength?)` | 按文档 id 获取全文（Markdown 格式，超长可截断） |

## 安装

```sh
# 在能访问内网的机器上，从 DSH checkout 根目录执行（本机示例）：
node <dsh-checkout>/apps/cli/lib/bin.js plugin --profile web add <本目录绝对路径>
# 已安装 dsh CLI 时：dsh plugin --profile web add <本目录>
```

安装后需**重启 `dsh web`**（插件的 host 部分在启动时加载）。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 中追加（用同样的 `id` 覆盖插件行的 config）：

```yaml
- insert:
    - id: outline-kb
      name: 'dsh-outline-kb'
      config:
        baseUrl: https://outline.你的公司域名.com
```

API token 二选一（**推荐环境变量**，避免密钥进 git）：

```sh
# 方式一：环境变量（插件启动时读取）
OUTLINE_API_TOKEN=xxx
# 方式二：写入插件行 config
#       apiToken: xxx
```

未配置时插件**正常加载**，调用工具会返回明确的中文配置错误提示，不会影响 GUI 启动。

## 本地开发与验证（无真实实例时）

```sh
pnpm install
pnpm typecheck          # tsc 严格检查
pnpm build              # 产出 lib/
pnpm test               # vitest 单测（mock fetch：成功/空/401/403/404/429/网络/坏响应）
node scripts/smoke.mjs  # 起本地 Mock Outline server，端到端冒烟（输出 SMOKE PASS）
```

### 关于 `@deepseek-ai/*` 依赖的解析

本插件运行时从 DSH 安装内盒解析 `@deepseek-ai/dsh-tools` 等包，因此**开发/构建时**也需要让它们可解析。
当前实现：在插件 `node_modules/@deepseek-ai` 创建 junction 指向本机 DSH 的扁平包目录
（`~/.dsh/profiles/node_modules/@deepseek-ai`，由 DSH 启动时维护，内含绝对路径链接）。

```powershell
# 在本插件目录执行一次（需要管理员/完整权限）：
New-Item -ItemType Junction -Path .\node_modules\@deepseek-ai -Target "$env:USERPROFILE\.dsh\profiles\node_modules\@deepseek-ai"
```

> 等 DSH 官方将 rc 版本发布到 npm 后，可改回在 `devDependencies` 里声明这些包。

## 卸载

```sh
dsh plugin --profile web remove dsh-outline-kb
```

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 工具报"认证失败（HTTP 401/403）" | token 无效或无权访问；在 Outline 设置 → API 密钥 重新生成 |
| 工具报"无法连接"或超时 | baseUrl 错误或网络不可达（内网/VPN）；`curl <baseUrl>/api/documents.search` 自查 |
| 工具报 404 | 文档 id 错误或无权访问 |
| 未配置报错 | 按上文"配置"补 baseUrl 与 token |
