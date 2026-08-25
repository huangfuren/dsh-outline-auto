import { defineTool } from '@deepseek-ai/dsh-tools'
import type { OutlineClient, OutlineSearchHit, OutlineDocument } from './client.js'

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

function renderSearchResults(hits: OutlineSearchHit[]): string {
  if (hits.length === 0) return '未找到匹配文档，可尝试更换关键词。'
  const lines = hits.map((hit) => {
    const meta = hit.snippet.length > 0 ? ` — ${hit.snippet}` : ''
    return `- [${escapeLinkText(hit.title)}](${wrapUrl(hit.url)})${meta}（id: ${hit.id}）`
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
      limit: { type: 'integer', description: `返回结果条数（默认 ${defaultLimit}，最大 ${SEARCH_MAX_LIMIT}）` },
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
            snippet: { type: 'string', required: true },
            collectionId: { type: 'string', required: true },
            updatedAt: { type: 'string', required: true },
          },
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
