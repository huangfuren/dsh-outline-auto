import { OutlineApiError, throwForStatus } from './errors.js'

export interface OutlineSearchHit {
  id: string
  title: string
  url: string
  snippet: string
  collectionId: string
  updatedAt: string
  parentDocumentId?: string
}

/** 搜索结果：命中列表 + 该关键词在知识库中的匹配总数（pagination.total）。 */
export interface OutlineSearchResult {
  total: number
  hits: OutlineSearchHit[]
}

export interface OutlineDocument {
  id: string
  title: string
  url: string
  text: string
  updatedAt: string
  collectionId?: string
  parentDocumentId?: string
}

/** Outline 集合（collections.list 条目）。documentCount 部分实例可能不返回。 */
export interface OutlineCollection {
  id: string
  name: string
  permission: string
  documentCount?: number
}

/** outline_create 返回：创建后的文档信息。 */
export interface OutlineCreateResult {
  id: string
  url: string
  title: string
  published: boolean
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
  /** listCollections 的短期缓存，供审批钩子解析集合名。 */
  private collectionsCache: { expires: number; collections: OutlineCollection[] } | null = null

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

  /** 请求并返回完整 JSON 响应体（data + pagination 等元数据）。 */
  private async requestJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    let json: Record<string, unknown>
    try {
      json = JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      throw new OutlineApiError('invalid-response', 'Outline 返回了无法解析的响应。')
    }
    return json
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const json = await this.requestJson(path, body)
    const data = json.data
    if (data === undefined) throw new OutlineApiError('invalid-response', 'Outline 响应缺少 data 字段。')
    return data as T
  }

  async searchDocuments(query: string, limit: number, collectionId?: string, filters?: { userId?: string; updatedAfter?: string }, offset = 0): Promise<OutlineSearchResult> {
    const json = await this.requestJson(`/api/documents.search`, {
      query,
      limit,
      ...(offset > 0 ? { offset } : {}),
      ...(collectionId !== undefined && collectionId !== '' ? { collectionId } : {}),
      ...(filters?.userId !== undefined && filters.userId !== '' ? { userId: filters.userId } : {}),
      ...(filters?.updatedAfter !== undefined && filters.updatedAfter !== '' ? { updatedAfter: filters.updatedAfter } : {}),
    })
    const data = Array.isArray(json.data) ? json.data : []
    const pagination = (json.pagination ?? {}) as { total?: unknown }
    const hits: OutlineSearchHit[] = data.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>
      const document = (record.document ?? {}) as Record<string, unknown>
      return {
        id: typeof document.id === 'string' ? document.id : '',
        title: OutlineClient.stripHtml(typeof document.title === 'string' ? document.title : '(无标题)'),
        url: this.absolutize(typeof document.url === 'string' ? document.url : ''),
        snippet: OutlineClient.stripHtml(typeof record.context === 'string' ? record.context : ''),
        collectionId: typeof document.collectionId === 'string' ? document.collectionId : '',
        updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : '',
        ...(document.parentDocumentId !== undefined && document.parentDocumentId !== null
          ? { parentDocumentId: String(document.parentDocumentId) }
          : {}),
      }
    })
    const total = typeof pagination.total === 'number' ? pagination.total : hits.length
    return { total, hits }
  }

  /** 统计 Outline 知识库文档总数（documents.list 分页 total；不含已删除/回收站文档）。 */
  async countDocuments(filters: Record<string, unknown> = {}): Promise<number> {
    const json = await this.requestJson(`/api/documents.list`, { limit: 1, ...filters })
    const pagination = (json.pagination ?? {}) as { total?: unknown }
    return typeof pagination.total === 'number' ? pagination.total : 0
  }

  /** 列出当前 token 可见的集合（60s 缓存）。注：实例要求 collections.list 带查询串。 */
  async listCollections(force = false): Promise<OutlineCollection[]> {
    const cached = this.collectionsCache
    if (!force && cached !== null && cached !== undefined && cached.expires > Date.now()) return cached.collections
    // Outline 分页：循环拉取直到收齐 pagination.total（防止集合数超过一页时漏集合）
    const collections: OutlineCollection[] = []
    const pageSize = 100
    for (let offset = 0; ; offset += pageSize) {
      const json = await this.requestJson(`/api/collections.list?limit=${pageSize}&offset=${offset}`, {})
      const data = Array.isArray(json.data) ? json.data : []
      for (const item of data) {
        const c = (item ?? {}) as Record<string, unknown>
        collections.push({
          id: typeof c.id === 'string' ? c.id : '',
          name: typeof c.name === 'string' ? c.name : '(未命名集合)',
          permission: typeof c.permission === 'string' ? c.permission : '',
          ...(typeof c.documentCount === 'number' ? { documentCount: c.documentCount } : {}),
        })
      }
      const pagination = (json.pagination ?? {}) as { total?: unknown }
      const total = typeof pagination.total === 'number' ? pagination.total : collections.length
      if (data.length === 0) break
      if (collections.length >= total) break
    }
    this.collectionsCache = { expires: Date.now() + OutlineClient.DOC_CACHE_TTL_MS, collections }
    return collections
  }

  /** 在指定集合创建文档（默认发布；可指定父文档实现嵌套）。 */
  async createDocument(input: { collectionId: string; title: string; text: string; publish?: boolean; parentDocumentId?: string }): Promise<OutlineCreateResult> {
    const data = await this.request<Record<string, unknown>>(`/api/documents.create`, {
      collectionId: input.collectionId,
      title: input.title,
      text: input.text,
      publish: input.publish ?? true,
      ...(input.parentDocumentId !== undefined && input.parentDocumentId !== '' ? { parentDocumentId: input.parentDocumentId } : {}),
    })
    // 新建后集合文档数变化，失效集合缓存
    this.collectionsCache = null
    return {
      id: typeof data.id === 'string' ? data.id : '',
      url: this.absolutize(typeof data.url === 'string' ? data.url : ''),
      title: OutlineClient.stripHtml(typeof data.title === 'string' ? data.title : input.title),
      published: typeof data.published === 'boolean' ? data.published : true,
    }
  }

  /** 更新已有文档（至少提供 title 或 text 之一）。 */
  async updateDocument(id: string, input: { title?: string; text?: string }): Promise<OutlineCreateResult> {
    const payload: Record<string, unknown> = { id }
    if (input.title !== undefined && input.title !== '') payload.title = input.title
    if (input.text !== undefined && input.text !== '') payload.text = input.text
    const data = await this.request<Record<string, unknown>>(`/api/documents.update`, payload)
    // 更新后清除该文档缓存，避免 60s 内读到旧内容
    this.docCache.delete(id)
    return {
      id: typeof data.id === 'string' ? data.id : id,
      url: this.absolutize(typeof data.url === 'string' ? data.url : ''),
      title: OutlineClient.stripHtml(typeof data.title === 'string' ? data.title : input.title ?? id),
      published: typeof data.published === 'boolean' ? data.published : true,
    }
  }

  /** 删除文档（本实例无回收站端点，为硬删；调用方必须已通过双重审批）。 */
  async deleteDocument(id: string): Promise<{ success: boolean }> {
    // 本实例 delete 响应形如 {success:true, ok:true}，无 data 字段 → 用 requestJson 直接读
    const json = await this.requestJson(`/api/documents.delete`, { id })
    // 删除后清除文档缓存与集合缓存（文档数/可见性变化）
    this.docCache.delete(id)
    this.collectionsCache = null
    return { success: json.success !== false }
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
      ...(data.collectionId !== undefined && data.collectionId !== null ? { collectionId: String(data.collectionId) } : {}),
      ...(data.parentDocumentId !== undefined && data.parentDocumentId !== null
        ? { parentDocumentId: String(data.parentDocumentId) }
        : {}),
    }
    this.docCache.set(id, { expires: Date.now() + OutlineClient.DOC_CACHE_TTL_MS, doc })
    return doc
  }

  /** 列出某父文档下的直接子文档（用于路径定位；本地匹配名称，避免搜索分词歧义）。 */
  async listChildDocuments(parentDocumentId: string, pageSize = 100): Promise<OutlineSearchHit[]> {
    // Outline documents.list 分页：循环拉取直到收齐 total（防止子文档超过一页时漏项）
    const hits: OutlineSearchHit[] = []
    for (let offset = 0; ; offset += pageSize) {
      const json = await this.requestJson(`/api/documents.list`, {
        parentDocumentId,
        limit: pageSize,
        ...(offset > 0 ? { offset } : {}),
      })
      const data = Array.isArray(json.data) ? json.data : []
      for (const item of data) {
        const d = (item ?? {}) as Record<string, unknown>
        hits.push({
          id: typeof d.id === 'string' ? d.id : '',
          title: OutlineClient.stripHtml(typeof d.title === 'string' ? d.title : '(无标题)'),
          url: this.absolutize(typeof d.url === 'string' ? d.url : ''),
          snippet: '',
          collectionId: typeof d.collectionId === 'string' ? d.collectionId : '',
          updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
          ...(d.parentDocumentId !== undefined && d.parentDocumentId !== null ? { parentDocumentId: String(d.parentDocumentId) } : {}),
        })
      }
      const pagination = (json.pagination ?? {}) as { total?: unknown }
      const total = typeof pagination.total === 'number' ? pagination.total : hits.length
      if (data.length === 0) break
      if (hits.length >= total) break
    }
    return hits
  }

  /** 解析一个文档的完整路径：返回 [集合名, 顶级目录, …, 文档名]（自顶向下）。 */
  async resolveDocumentPath(docId: string): Promise<string[]> {
    const titles: string[] = []
    let collectionId: string | undefined
    let currentId = docId
    const seen = new Set<string>()
    while (currentId !== undefined && currentId !== '' && !seen.has(currentId)) {
      seen.add(currentId)
      const doc = await this.getDocument(currentId)
      collectionId ??= doc.collectionId
      titles.unshift(doc.title)
      currentId = doc.parentDocumentId ?? ''
    }
    if (collectionId !== undefined) {
      const collections = await this.listCollections()
      const coll = collections.find((c) => c.id === collectionId)
      if (coll !== undefined) titles.unshift(coll.name)
    }
    return titles
  }
}