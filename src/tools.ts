import { defineTool } from '@deepseek-ai/dsh-tools'
import type { OutlineClient, OutlineSearchResult, OutlineDocument, OutlineCollection, OutlineCreateResult } from './client.js'

export const SEARCH_MAX_LIMIT = 25
export const DOCUMENT_DEFAULT_MAX_LENGTH = 20000
export const DOCUMENT_MAX_LENGTH_CAP = 200000

/** 转义链接文字里的 Markdown 特殊字符，避免标题含 []() 时破坏 [title](url) 链接。 */
function escapeLinkText(text: string): string {
  return text.replace(/[\\[\]]/g, (ch) => (ch === '\\' ? '\\\\' : '\\' + ch))
}

/** URL 含空格或括号时用 <> 包裹，保证 markdown 链接闭合正确。 */
function wrapUrl(url: string): string {
  return /[\s()]/.test(url) ? `<${url}>` : url
}

function renderSearchResults(result: OutlineSearchResult): string {
  const { total, hits } = result
  if (hits.length === 0) {
    return total > 0 ? `该关键词共匹配 ${total} 篇文档，但未返回可展示的结果。` : '未找到匹配文档，可尝试更换关键词。'
  }
  const head = `找到 ${hits.length} 篇文档${total > hits.length ? `（关键词共匹配 ${total} 篇，显示前 ${hits.length} 篇）` : ''}：`
  const lines = hits.map((hit) => {
    const meta = hit.snippet.length > 0 ? ` — ${hit.snippet}` : ''
    return `- [${escapeLinkText(hit.title)}](${wrapUrl(hit.url)})${meta}（id: ${hit.id}）`
  })
  return `${head}\n${lines.join('\n')}\n\n如需查看某篇全文，请使用 outline_get_document 工具（参数 id）。`
}

function renderDocument(doc: OutlineDocument, truncated: boolean): string {
  const note = truncated ? '\n\n…（内容过长已截断，可增大 maxLength 参数）' : ''
  return `# ${doc.title}\n\n${doc.url}\n\n${doc.text}${note}`
}

export function outlineSearchTool(makeClient: () => OutlineClient, defaultLimit: number) {
  return defineTool({
    name: 'outline_search',
    description: '在 Outline 知识库中按关键词搜索文档，返回该关键词的匹配总数、标题、命中片段、文档 id 与链接。可选按集合/作者/更新时间过滤。配置好 token 后即可检索全部文档。',
    parameters: {
      query: { type: 'string', required: true, description: '搜索关键词' },
      limit: { type: 'integer', description: `返回结果条数（默认 ${defaultLimit}，最大 ${SEARCH_MAX_LIMIT}）` },
      collectionId: { type: 'string', description: '可选，限定搜索某个集合（用 outline_list_collections 获取 id）' },
      userId: { type: 'string', description: '可选，按作者过滤（用户 id，如查"某人的文档"）' },
      updatedAfter: { type: 'string', description: '可选，只返回此时间之后更新的文档（ISO 时间，如 2026-08-01T00:00:00Z 或 2026-08-01）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'integer', required: true, description: '该关键词在知识库中的匹配总数' },
          hits: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                url: { type: 'string', required: true },
                snippet: { type: 'string', required: true },
                collectionId: { type: 'string', required: true },
                updatedAt: { type: 'string', required: true },
                parentDocumentId: { type: 'string', description: '父文档 id（顶层文档为空）' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderSearchResults(value) }],
    },
    async execute(args) {
      const limit = Math.min(SEARCH_MAX_LIMIT, Math.max(1, args.limit ?? defaultLimit))
      const client = makeClient()
      return client.searchDocuments(args.query, limit, args.collectionId, {
        userId: args.userId,
        updatedAfter: args.updatedAfter,
      })
    },
  })
}

export function outlineCountTool(makeClient: () => OutlineClient) {
  return defineTool({
    name: 'outline_count',
    description: '统计 Outline 知识库文档总数（documents.list 分页 total，精确值；不含已删除/回收站文档，若计入则实际总数可能略多）。用于回答"知识库有多少文档 / 多大"等问题；若要检索具体文档请用 outline_search。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'integer', required: true, description: 'Outline 知识库文档总数（不含已删除/回收站文档）' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Outline 知识库当前可访问文档总数：${value.total} 篇。` }],
    },
    async execute() {
      return { total: await makeClient().countDocuments() }
    },
  })
}

export function outlineGetDocumentTool(makeClient: () => OutlineClient) {
  return defineTool({
    name: 'outline_get_document',
    description: '按文档 id（来自 outline_search 的结果或 Outline 的 urlId）获取文档完整内容（Markdown 格式）。',
    parameters: {
      id: { type: 'string', required: true, description: '文档 UUID 或 urlId' },
      maxLength: { type: 'integer', description: '返回内容最大字符数（默认 20000，最小 1000，最大 200000），超出截断' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
          url: { type: 'string', required: true },
          text: { type: 'string', required: true },
          truncated: { type: 'boolean', required: true },
          updatedAt: { type: 'string', required: true },
          collectionId: { type: 'string', description: '所属集合 id' },
          parentDocumentId: { type: 'string', description: '父文档 id（顶层文档为空）' },
        },
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

/** 审批提示文案：完整路径 + 标题 + 内容预览（前 100 字，纯函数可单测）。 */
export function buildCreateApprovalReason(
  args: { collectionId?: string; title?: string; text?: string },
  collectionName?: string,
  resolvedPath?: string[],
): string {
  const location = resolvedPath !== undefined && resolvedPath.length > 0
    ? `路径：${resolvedPath.join(' / ')}`
    : `集合「${collectionName && collectionName !== '' ? collectionName : (args.collectionId ?? '未知集合')}」`
  const preview = (args.text ?? '').replace(/\s+/g, ' ').slice(0, 100)
  return `在以下位置创建 Outline 文档：\n${location}\n标题：「${args.title ?? '(无标题)'}」\n内容预览：${preview}${(args.text ?? '').length > 100 ? '…' : ''}`
}

/** 默认受保护集合（settings 未配置时的兜底）。 */
export const FORBIDDEN_WRITE_COLLECTIONS: readonly string[] = ['内部集合']

/** 写工具守卫来源：返回当前受保护集合名列表。 */
export interface WriteGuards {
  protectedCollections: () => string[]
}

/** 团队标准需求文档模板（Markdown，依据团队规范的需求对齐模板 v4）。
 * 排版约定：条目类章节（需求或目标/交付物/交付标准/潜在风险点/工作思路）如有多个条目，
 * 必须换行并逐条编号（1、2、3、… 一点一行），不要挤成一段。 */
export const REQUIREMENT_DOC_TEMPLATE = [
  '# <标题>-需求文档',
  '',
  '【需求或目标】：<一句话概括核心目标；如有多个目标，逐条列出>',
  '1、<目标 1>',
  '2、<目标 2>',
  '',
  '【交付物】：<如有多个交付物，一点一行，罗列清晰>',
  '1、<交付物 1>',
  '2、<交付物 2>',
  '3、<交付物 3>',
  '',
  '【交付标准】：<做成什么样算好；多条标准逐条列出>',
  '1、<标准 1>',
  '2、<标准 2>',
  '',
  '【交付时间】：<具体时间，如 YYYY-MM-DD 或 今日 14:30 前>',
  '',
  '【潜在风险点】：<哪里可能卡住；多个风险逐条列出>',
  '1、<风险 1>',
  '2、<风险 2>',
  '',
  '【解决的问题】：<具体帮谁，解决了什么问题；多个逐条列出>',
  '1、<问题 1>',
  '',
  '【工作思路】：<分步骤，一步一行>',
  '1. <第一步>',
  '2. <第二步>',
  '3. <第三步>',
  '',
  '【备注】：<可写可不写，如参考文档链接、工具访问地址、账号权限说明>',
  '',
  '### 当前状态：待交付',
  '',
].join('\n')

/** 模板的章节清单（供 AI 核对是否写全）。 */
export const REQUIREMENT_DOC_SECTIONS = ['需求或目标', '交付物', '交付标准', '交付时间', '潜在风险点', '解决的问题', '工作思路', '备注', '当前状态']

export function outlineDocTemplateTool() {
  return defineTool({
    name: 'outline_doc_template',
    description: '返回团队标准的需求文档模板（Markdown）与章节清单。撰写/更新需求文档前先调用本工具获取模板，保证格式一致。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          template: { type: 'string', required: true, description: '需求文档标准模板（Markdown）' },
          sections: { type: 'array', required: true, items: { type: 'string' }, description: '必须包含的章节清单' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `需求文档标准模板（章节：${value.sections.join(' / ')}）：\n\n${value.template}`,
      }],
    },
    async execute() {
      return { template: REQUIREMENT_DOC_TEMPLATE, sections: [...REQUIREMENT_DOC_SECTIONS] }
    },
  })
}

/**
 * 写入守卫：按集合名判断是否允许写入（创建/更新/删除）。
 * @returns 禁止时返回错误提示文案；允许时返回 null。
 */
export function resolveWriteGuard(collections: OutlineCollection[], collectionId: string, protectedList: string[]): string | null {
  const name = (collections.find((c) => c.id === collectionId)?.name ?? '').trim()
  if (name !== '' && protectedList.some((p) => p.trim() !== '' && normalizeName(p) === normalizeName(name))) {
    return `禁止在集合「${name}」写入文档（该集合受保护，不允许修改）。`
  }
  return null
}

/** 名称归一化：小写并去掉破折号/空格/下划线/括号，容忍"随手记黄继晨"与"随手记-黄继晨"这类差异。 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[-_·\s（）()]/g, '')
}

/** 在候选中按名称匹配：先精确（归一化后），再包含匹配；多个命中返回 null 并给出候选。 */
function matchName(candidates: Array<{ id: string; name: string }>, wanted: string): { id: string; name: string } | null {
  const target = normalizeName(wanted)
  const exact = candidates.filter((c) => normalizeName(c.name) === target)
  if (exact.length === 1) return exact[0]
  const partial = candidates.filter((c) => normalizeName(c.name).includes(target))
  if (partial.length === 1) return partial[0]
  return null
}

export function outlineResolvePathTool(makeClient: () => OutlineClient) {
  return defineTool({
    name: 'outline_resolve_path',
    description: '把用户描述的知识库路径（如"运维文档/目录A/子目录"）解析为具体的 collectionId 与 parentDocumentId，并返回解析出的完整路径。用于定位"在某某目录下创建文档"的目标位置；解析成功后把返回的 id 传给 outline_create（创建前用户还会看到完整路径确认）。',
    parameters: {
      path: { type: 'string', required: true, description: '路径，用 / 分隔：第一段是集合名，后续段是逐级目录（文档）名，如 运维文档/目录A/子目录' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          collectionId: { type: 'string', required: true },
          parentDocumentId: { type: 'string' },
          path: {
            type: 'array',
            required: true,
            items: { type: 'string' },
            description: '解析出的完整路径段（自顶向下）',
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.parentDocumentId !== undefined && value.parentDocumentId !== null && value.parentDocumentId !== ''
          ? `已定位：${value.path.join(' / ')}\ncollectionId=${value.collectionId}\nparentDocumentId=${value.parentDocumentId}`
          : `已定位：${value.path.join(' / ')}（集合根级）\ncollectionId=${value.collectionId}`,
      }],
    },
    async execute(args) {
      const client = makeClient()
      const segments = args.path.split('/').map((s) => s.trim()).filter((s) => s !== '')
      if (segments.length === 0) throw new Error('路径不能为空，格式：集合名/目录1/目录2/...')

      // 第一段：集合
      const collections = await client.listCollections()
      const coll = matchName(collections, segments[0])
      if (coll === null) {
        throw new Error(`找不到集合「${segments[0]}」。可见集合：${collections.map((c) => c.name).join('、')}`)
      }

      // 后续段：逐级定位子文档（目录）
      // 根层级用集合内搜索（顶层目录名通常较短）；更深层级用 documents.list 拉全量子文档本地匹配（避免搜索分词歧义）。
      const resolvedNames = [coll.name]
      let parentId: string | undefined
      for (const seg of segments.slice(1)) {
        let candidates: Array<{ id: string; name: string }>
        if (parentId === undefined) {
          const { hits } = await client.searchDocuments(seg, 25, coll.id)
          candidates = hits
            .filter((h) => h.parentDocumentId === undefined || h.parentDocumentId === null || h.parentDocumentId === '')
            .map((h) => ({ id: h.id, name: h.title }))
        } else {
          candidates = (await client.listChildDocuments(parentId)).map((h) => ({ id: h.id, name: h.title }))
        }
        const matched = matchName(candidates, seg)
        if (matched === null) {
          const available = candidates.length > 0 ? `候选：${candidates.map((c) => c.name).join('、')}` : '该层级没有匹配的子文档'
          throw new Error(`在「${resolvedNames.join(' / ')}」下找不到「${seg}」。${available}`)
        }
        parentId = matched.id
        resolvedNames.push(matched.name)
      }

      return {
        collectionId: coll.id,
        ...(parentId !== undefined ? { parentDocumentId: parentId } : {}),
        path: resolvedNames,
      }
    },
  })
}

export function outlineListCollectionsTool(makeClient: () => OutlineClient) {
  return defineTool({
    name: 'outline_list_collections',
    description: '列出当前 token 可见的 Outline 集合（id、名称、权限、文档数），用于确定 outline_create 的目标集合。',
    parameters: {},
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            permission: { type: 'string', required: true },
            documentCount: { type: 'integer', description: '文档数（部分实例可能不返回）' },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.length === 0
          ? '当前 token 没有可见集合。'
          : `可见集合（${value.length} 个）：\n` + value.map((c) => `- ${c.name}（${c.id}，${c.permission}${typeof c.documentCount === 'number' ? `，文档 ${c.documentCount} 篇` : ''}）`).join('\n'),
      }],
    },
    async execute() {
      return makeClient().listCollections()
    },
  })
}

export function outlineCreateTool(makeClient: () => OutlineClient, getProtected: () => string[]) {
  return defineTool({
    name: 'outline_create',
    description: '在指定 Outline 集合创建文档（写操作，每次执行前需用户审批，审批展示解析后的完整路径）。创建后返回文档链接。请先用 outline_list_collections / outline_resolve_path 确认目标位置。',
    parameters: {
      collectionId: { type: 'string', required: true, description: '目标集合 id（用 outline_list_collections 获取）' },
      parentDocumentId: { type: 'string', description: '可选，父文档 id（嵌套目录）；不填则创建在集合根级' },
      title: { type: 'string', required: true, description: '文档标题' },
      text: { type: 'string', required: true, description: 'Markdown 正文' },
      publish: { type: 'boolean', description: '默认 true（创建即发布）；false = 存草稿（仅作者可见）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
          published: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.published
          ? `✅ 已创建并发布文档：${escapeLinkText(value.title)} → ${wrapUrl(value.url)}`
          : `📝 已创建草稿（未发布）：${escapeLinkText(value.title)} → ${wrapUrl(value.url)}`,
      }],
    },
    async execute(args) {
      const client = makeClient()
      // 写入守卫：受保护集合一律拒绝（防御纵深，即使绕过审批直调也会被拦）
      const guard = resolveWriteGuard(await client.listCollections(), args.collectionId, getProtected())
      if (guard !== null) throw new Error(guard)
      return client.createDocument({
        collectionId: args.collectionId,
        parentDocumentId: args.parentDocumentId,
        title: args.title,
        text: args.text,
        publish: args.publish,
      })
    },
  })
}

export function outlineUpdateDocumentTool(makeClient: () => OutlineClient, getProtected: () => string[]) {
  return defineTool({
    name: 'outline_update_document',
    description: '更新已有 Outline 文档的标题/正文（写操作，执行前需用户审批，审批展示文档完整路径）。',
    parameters: {
      id: { type: 'string', required: true, description: '文档 id（来自 outline_search / outline_get_document）' },
      title: { type: 'string', description: '可选，新标题' },
      text: { type: 'string', description: '可选，新 Markdown 正文' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
          published: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `✏️ 已更新文档：${escapeLinkText(value.title)} → ${wrapUrl(value.url)}` }],
    },
    async execute(args) {
      if ((args.title === undefined || args.title === '') && (args.text === undefined || args.text === '')) {
        throw new Error('outline_update_document 至少需要 title 或 text 之一')
      }
      const client = makeClient()
      const doc = await client.getDocument(args.id)
      const guard = resolveWriteGuard(await client.listCollections(), doc.collectionId ?? '', getProtected())
      if (guard !== null) throw new Error(guard)
      return client.updateDocument(args.id, { title: args.title, text: args.text })
    },
  })
}

/** 二次审批回调：由 index.ts 接线到 ctx.approval.request，返回是否 allowed-once。 */
export type DeleteApprovalRequester = (reason: string, exec: { agent?: unknown; callId?: unknown }) => Promise<boolean>

export function outlineDeleteTool(
  makeClient: () => OutlineClient,
  getProtected: () => string[],
  requestApproval: DeleteApprovalRequester,
) {
  return defineTool({
    name: 'outline_delete',
    description: '删除 Outline 文档（**不可恢复**，双重审批：第一道在调用时弹窗，第二道在删除执行前再次确认）。',
    parameters: {
      id: { type: 'string', required: true, description: '文档 id（来自 outline_search / outline_get_document）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          success: { type: 'boolean', required: true },
          id: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `🗑 已删除文档（${value.id}）` }],
    },
    async execute(args, exec) {
      const client = makeClient()
      const doc = await client.getDocument(args.id)
      const guard = resolveWriteGuard(await client.listCollections(), doc.collectionId ?? '', getProtected())
      if (guard !== null) throw new Error(guard)
      // 第二道审批（第一道在 pre-execute 钩子）；暂停等待用户点同意
      const ok = await requestApproval(
        `再次确认删除文档（不可恢复）：\n路径：${(await client.resolveDocumentPath(args.id)).join(' / ')}\n标题：「${doc.title}」`,
        exec,
      )
      if (!ok) throw new Error('删除已被用户取消（第二道确认未通过）。')
      const result = await client.deleteDocument(args.id)
      return { success: result.success, id: args.id }
    },
  })
}

export function outlineListChildrenTool(makeClient: () => OutlineClient) {
  return defineTool({
    name: 'outline_list_children',
    description: '列出某目录（父文档）下的直接子文档，用于浏览知识库目录结构。',
    parameters: {
      parentId: { type: 'string', required: true, description: '父文档 id（目录）' },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            url: { type: 'string', required: true },
            snippet: { type: 'string', description: '摘要片段（列表接口通常为空）' },
            collectionId: { type: 'string', required: true },
            updatedAt: { type: 'string', required: true },
            parentDocumentId: { type: 'string', description: '父文档 id' },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.length === 0
          ? '该目录下没有子文档。'
          : `子文档（${value.length} 个）：\n` + value.map((d) => `- [${escapeLinkText(d.title)}](${wrapUrl(d.url)})`).join('\n'),
      }],
    },
    async execute(args) {
      return makeClient().listChildDocuments(args.parentId)
    },
  })
}
