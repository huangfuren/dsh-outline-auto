# dsh-outline-ai

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

### 从压缩包分享给他人

把 `dsh-outline-ai` 目录压成 zip 时**务必排除 `node_modules` 与 `.git`**（`node_modules` 里的 junction 指向打包者机器的路径，接收者机器上不存在；运行时 DSH 会自动解析 `@deepseek-ai/*`，接收者**无需**重建 junction 即可运行，junction 只在本地开发/构建时需要）。接收者流程：

1. 解压 zip（目录名保持 `dsh-outline-ai`）
2. 执行 `dsh plugin --profile web add <解压后目录绝对路径>`
3. 重启 `dsh web`
4. 打开 **设置 → 插件 → 插件配置 → Outline 知识库** 卡片，填自己公司的 baseUrl 与自己的 API Token，点保存
5. 直接对话中搜索即可；无需改任何配置文件

**前置条件**：接收者的机器能访问公司 Outline 实例（内网/VPN），且有有效 API Token。压缩包里不包含任何人的 token。

## 配置（推荐：GUI 设置卡片）

插件自带**配置卡片**：安装并重启后，打开 **设置 → 插件 → 插件配置**，找到 **Outline 知识库** 卡片，填入两项后点保存（立即生效，无需重启）：

| 字段 | 说明 |
| --- | --- |
| 服务地址 (baseUrl) | Outline 实例根地址，如 `https://outline.你的公司域名.com` |
| API Token | Outline 设置 → API 密钥 中生成 |

卡片数据写入 `$DSH_HOME/settings.yaml` 的 `outline-ai` 命名空间（不进 git）。**每个用户安装后各自在 GUI 里填自己的 token 即可，方便插件分发。**

配置优先级：**GUI 卡片（settings.yaml）→ 环境变量 → 插件配置行**。未配置时插件正常加载，调用工具返回明确的中文配置错误提示，不影响 GUI 启动。

### 备选配置方式

```sh
# 方式一：环境变量（进程启动时读取）
OUTLINE_BASE_URL=https://outline.你的公司域名.com
OUTLINE_API_TOKEN=xxx
```

```yaml
# 方式二：插件配置行（~/.dsh/profiles/web/cordis.patch.yml）
- id: outline-ai
  config:
    baseUrl: https://outline.你的公司域名.com
    apiToken: xxx
```

## 本地开发与验证（无真实实例时）

```sh
pnpm install
pnpm typecheck          # tsc 严格检查
pnpm build              # 产出 lib/
pnpm test               # vitest 单测（mock fetch：成功/空/401/403/404/429/网络/坏响应）
node scripts/smoke.mjs  # 起本地 Mock Outline server，端到端冒烟（输出 SMOKE PASS）
node scripts/verify-settings.mjs   # settings 命名空间 → settings.yaml → 真实搜索 全链路验证
```

### 客户端（设置卡片）说明

- `client.js` 是浏览器半区（单文件模块，无构建步骤），注册 `settings.plugin.item` 卡片，读写 `outline-ai` 命名空间。
- 安装后需重启 GUI 才会加载客户端半区（客户端清单在启动时生成）。
- 修改 `client.js` 后无需构建，重启 GUI 或客户端插件热更新即可生效。

### 关于 `@deepseek-ai/*` 依赖的解析

本插件运行时从 DSH 安装内盒解析 `@deepseek-ai/dsh-tools` 等包，因此**开发/构建时**也需要让它们可解析。
当前实现：在插件 `node_modules/@deepseek-ai` 创建 junction 指向本机 DSH 的扁平包目录
（`~/.dsh/profiles/node_modules/@deepseek-ai`，由 DSH 启动时维护，内含绝对路径链接）。

```powershell
# 在本插件目录执行一次（需要管理员/完整权限）：
New-Item -ItemType Junction -Path .\node_modules\@deepseek-ai -Target "$env:USERPROFILE\.dsh\profiles\node_modules\@deepseek-ai"
```

> 等 DSH 官方将 rc 版本发布到 npm 后，可改回在 `devDependencies` 里声明这些包。

## 启停

插件会出现在 设置 → 插件 → 插件列表 中（只读状态）。启停开关在 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
# 禁用（取消注释即生效，实时热加载，无需重启 GUI）：
# - id: outline-ai
#   disabled: true
```

## 卸载

```sh
dsh plugin --profile web remove dsh-outline-ai
```

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 工具报"认证失败（HTTP 401/403）" | token 无效或无权访问；在 Outline 设置 → API 密钥 重新生成 |
| 工具报"无法连接"或超时 | baseUrl 错误或网络不可达（内网/VPN）；`curl <baseUrl>/api/documents.search` 自查 |
| 工具报 404 | 文档 id 错误或无权访问 |
| 未配置报错 | 按上文"配置"补 baseUrl 与 token |
