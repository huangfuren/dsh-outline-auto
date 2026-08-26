# dsh-outline-auto

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
- **链接可直接点击**——文档链接按 `baseUrl` 解析为绝对地址（Outline 返回的是相对路径）；片段与标题会清理 HTML 标签，聊天里显示干净。
- **文档读取缓存（60 秒）**——会话内重复读取同一文档不会再次请求 API。
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

### 默认方式：AI 协助热安装（无需重启）

直接把 GitHub 链接发给你的 AI 助手，它两条命令就能帮你装好：

```bash
git clone https://github.com/huangfuren/dsh-outline-auto.git ~/.dsh/plugins/dsh-outline-auto
node ~/.dsh/plugins/dsh-outline-auto/scripts/hot-install.mjs
```

你也可以自己在终端执行。脚本会把插件链接进你的 profile，并向 `cordis.patch.yml` 追加 insert 行——DSH 热加载后**宿主端（工具）立即生效**，浏览器刷新一次页面即可看到设置卡片，**全程无需重启 `dsh web`**。卸载：`node ~/.dsh/plugins/dsh-outline-auto/scripts/hot-install.mjs --remove`。

> 插件从克隆位置建立链接——请放在稳定路径（如 `~/.dsh/plugins/dsh-outline-auto`）；脚本检测到临时目录时会提醒。

**更新已安装的插件**——把 GitHub 链接发给你的 AI 助手（或自己执行）：

```bash
node ~/.dsh/plugins/dsh-outline-auto/scripts/hot-install.mjs --update   # git pull + 生效说明
```

拉取后：**设置卡片刷新页面即更新**；**工具（宿主端）需重启 `dsh web`** 才能加载新代码（DSH 当前未启用模块级热更新）。

### 传统安装（需要重启）

```bash
dsh plugin --profile web add link:/path/to/dsh-outline-auto        # 开发（link 安装，实时源码）
dsh plugin --profile web add git+https://github.com/huangfuren/dsh-outline-auto.git   # 已发布
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
| `outline_search(query, limit?, collectionId?, userId?, updatedAfter?)` | 关键词搜索；返回该关键词的**匹配总数**，以及每条命中的标题、片段、文档 id 与链接。可选过滤：集合 / 作者(userId) / 更新时间之后(updatedAfter)。 |
| `outline_get_document(id, maxLength?)` | 按 id 取文档完整 Markdown；`maxLength` 限制返回长度（默认 20000）。 |
| `outline_count()` | Outline 知识库文档总数（`documents.list` 分页 total，精确值；不含已删除/回收站文档，实际总数可能略多）。 |
| `outline_list_collections()` | 列出可见集合（id、名称、权限、文档数）。 |
| `outline_resolve_path(path)` | 把人话路径（如 `运维文档/目录A/子目录`）解析为 `collectionId` + `parentDocumentId`，返回解析出的完整路径。 |
| `outline_list_children(parentId)` | 列出某目录（父文档）下的直接子文档。 |
| `outline_doc_template()` | 返回团队标准需求文档模板（Markdown）+ 必备章节清单——写需求文档前先调用，保证格式一致。 |
| `outline_create(collectionId, title, text, publish?, parentDocumentId?)` | **写操作**——创建文档（默认发布；`parentDocumentId` 可嵌套到目录）。**审批展示解析出的完整路径**。 |
| `outline_update_document(id, title?, text?)` | **写操作**——更新已有文档的标题/正文。**审批展示文档路径**。 |
| `outline_delete(id)` | **写操作，不可恢复**——删除文档。**双重审批**：先弹一次确认，执行删除前再确认一次。 |

> 受保护集合（设置卡片可配置，逗号分隔，默认 `内部集合`）**禁止任何写入**。

### 工作流：撰写需求文档（高频操作）

1. `outline_resolve_path("运维文档/目录A/子目录")` — 定位目标目录（得到 `collectionId` + `parentDocumentId`）
2. `outline_doc_template()` — 获取标准需求文档模板与必备章节（与集合置顶文档对齐）
3. 按模板起草内容 → `outline_create(collectionId, parentDocumentId, title, text)` — 审批弹窗展示解析后的完整路径，确认后创建
4. 用返回的链接校验位置

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
