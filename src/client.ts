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
  private readonly apiToken: string
  /** getDocument 的短期缓存（key = 文档 id），避免会话内重复读取同一文档反复请求 API。 */
  private readonly docCache = new Map<string, { expires: number; doc: OutlineDocument }>()
  private static readonly DOC_CACHE_TTL_MS = 60_000

  constructor(options: OutlineClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiToken = options.apiToken
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 15000
  }

  /** 去掉 Outline 片段/标题里的 HTML 标签（如 <b>），避免原样渲染进聊天。 */
  private static stripHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /** 把 Outline API 返回的相对文档路径（如 /doc/xxx）解析为可点击的绝对地址。 */
  private absolutize(url: string): string {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    return `${this.baseUrl}${url.startsWith('/') ? url : '/' + url}`
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
          Authorization: `Bearer ${this.apiToken}`,
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
        title: OutlineClient.stripHtml(typeof document.title === 'string' ? document.title : '(无标题)'),
        url: this.absolutize(typeof document.url === 'string' ? document.url : ''),
        snippet: OutlineClient.stripHtml(typeof record.context === 'string' ? record.context : ''),
        collectionId: typeof document.collectionId === 'string' ? document.collectionId : '',
        updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : '',
      }
    })
  }

  async getDocument(id: string): Promise<OutlineDocument> {
    const cached = this.docCache.get(id)
    if (cached !== undefined && cached.expires > Date.now()) return cached.doc
    const data = await this.request<Record<string, unknown>>(`/api/documents.info`, { id })
    const doc: OutlineDocument = {
      id: typeof data.id === 'string' ? data.id : id,
      title: OutlineClient.stripHtml(typeof data.title === 'string' ? data.title : '(无标题)'),
      url: this.absolutize(typeof data.url === 'string' ? data.url : ''),
      text: typeof data.text === 'string' ? data.text : '',
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    }
    this.docCache.set(id, { expires: Date.now() + OutlineClient.DOC_CACHE_TTL_MS, doc })
    return doc
  }
}