# dsh-outline-ai

[English](./README.md)

一个 DeepSeek Harness 插件：在对话里**搜索并读取 [Outline](https://www.getoutline.com/) 知识库**。给它一个关键词，它返回匹配文档的**标题、摘要与链接**；点开某篇，返回**完整的 Markdown 全文**。插件**只读**：只查询 Outline，不改任何文档源，也不参与同步流程。

> 项目状态：0.1.0。当前功能集已实现，并有单元测试、Mock 冒烟与 settings 全链路集成验证覆盖；开发环境之外的跨版本兼容性尚未认证。

## 核心思想

- 知识库就在一句话的距离：**你给关键词，它给文档链接**；
- 只读设计：插件只查 Outline，从不写文档；
- 每人带自己的凭据：**在 GUI 卡片里填，零配置文件**；
- 每个成员的接入流程都是同样的三步：安装 → 重启 → 配置。

## 功能

- **两个工具**（`outline_search(query, limit?)` / `outline_get_document(id, maxLength?)`）——关键词搜索返回标题、命中片段、文档 id 与链接；按 id 取全文 Markdown（超长可截断）。
- **GUI 配置卡片**——设置 → 插件 → 插件配置 里的 **Outline 知识库** 卡片（与官方卡片同款 UI）；填 `baseUrl` 和 API Token，点保存即完成。
- **每人各填各的 token**——每个用户在 GUI 里配置自己的凭据（存于 `$DSH_HOME/settings.yaml`，不进 git）；适合团队分发。
- **未配置也安全**——插件正常加载，工具返回明确的中文错误提示，不影响 GUI 启动。
- **保存即生效**——卡片保存后立即生效，无需重启；配置优先级：GUI 卡片 → 环境变量 → 插件配置行。
- **可启停**——出现在 设置 → 插件 → 插件列表；`cordis.patch.yml` 里注释一行即开关，热加载生效。
- **开箱即分发**——一条命令从 GitHub 安装；接收者无需构建（DSH 运行时会解析 `@deepseek-ai/*`），也无需 junction。

## 环境要求

| 组件 | 基线 |
| --- | --- |
| Node.js | 22.13 及以上 |
| DeepSeek Harness | 实测于 `0.1.1-rc.2` |
| Outline 实例 | 机器可访问（内网 / VPN），且有 API Token（Outline → 设置 → API 密钥） |

## 安装

开发（link 安装，实时源码）：

```bash
dsh plugin --profile web add link:/path/to/dsh-outline-ai
```

GitHub（已发布）：

```bash
dsh plugin --profile web add git+https://github.com/huangfuren/dsh-outline-ai.git
```

安装后需**重启 `dsh web`**（host 半区启动时加载；client 半区注册设置卡片）。

> 以压缩包分发时请排除 `node_modules` 与 `.git`——接收者无需 junction。

## 配置

推荐使用 **GUI 卡片**（设置 → 插件 → 插件配置 → Outline 知识库）：

| 字段 | 说明 |
| --- | --- |
| 服务地址 (baseUrl) | Outline 实例根地址，如 `https://outline.example.com` |
| API Token | Outline → 设置 → API 密钥 生成 |

点**保存**即生效。也可以用环境变量（`OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN`）或 `cordis.patch.yml` 的插件配置行配置。

## 工具

| 工具 | 说明 |
| --- | --- |
| `outline_search(query, limit?)` | 关键词搜索；每条返回标题、命中片段、文档 id 与链接（limit 最大 25）。 |
| `outline_get_document(id, maxLength?)` | 按 id 取文档完整 Markdown；`maxLength` 限制返回长度（默认 20000）。 |

## 开发

```bash
pnpm typecheck          # tsc 严格检查
pnpm build              # 产出 lib/
pnpm test               # vitest 单测（mock fetch：成功/空/401/403/404/429/网络/坏响应）
node scripts/smoke.mjs  # 起本地 Mock Outline server，端到端冒烟（输出 SMOKE PASS）
node scripts/verify-settings.mjs  # settings 命名空间 → settings.yaml → 真实搜索 全链路验证
```

客户端半区（`client.js`）是零依赖单文件模块，无需构建。真实搜索验证脚本需要 `OUTLINE_BASE_URL` / `OUTLINE_API_TOKEN` 环境变量。

## License

[MIT](./LICENSE)
