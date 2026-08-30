import { OutlineApiError, throwForStatus } from './errors.js';
export class OutlineClient {
    fetchImpl;
    timeoutMs;
    cacheTtlMs;
    baseUrl;
    apiToken;
    /** getDocument 的短期缓存（key = 文档 id），避免会话内重复读取同一文档反复请求 API。 */
    docCache = new Map();
    static DEFAULT_CACHE_TTL_MS = 60_000;
    /** 文档缓存条数上限：超限时按插入顺序淘汰最旧条目，防止长时间运行内存膨胀。 */
    static DOC_CACHE_MAX_ENTRIES = 200;
    /** 429 限流自动重试次数（指数退避，每次最多退避 5 秒）。 */
    static MAX_RETRIES = 3;
    /** listCollections 的短期缓存，供审批钩子解析集合名。 */
    collectionsCache = null;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.assertAllowedUrl(this.baseUrl);
        this.apiToken = options.apiToken;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
        this.timeoutMs = options.timeoutMs ?? 15000;
        this.cacheTtlMs = options.cacheTtlMs ?? OutlineClient.DEFAULT_CACHE_TTL_MS;
    }
    /** 安全校验：拒绝公网明文 http（避免 Token 明文传输），允许 https 以及本地/内网私有地址。 */
    assertAllowedUrl(baseUrl) {
        let parsed;
        try {
            parsed = new URL(baseUrl);
        }
        catch {
            throw new Error(`dsh-outline-auto 的 baseUrl 无法解析：${baseUrl}。请填写合法的 Outline 根地址。`);
        }
        if (parsed.protocol === 'https:')
            return;
        const host = parsed.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
        const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        const isPrivate = ipv4 !== null && (Number(ipv4[1]) === 10
            || (Number(ipv4[1]) === 172 && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31)
            || (Number(ipv4[1]) === 192 && Number(ipv4[2]) === 168)
            || Number(ipv4[1]) === 127);
        if (isLocal || isPrivate)
            return;
        throw new Error(`dsh-outline-auto 拒绝非 HTTPS 地址：${baseUrl}。为避免 Token 明文传输，公网地址必须使用 https://（localhost 与内网私有地址除外）。`);
    }
    /** 去掉 Outline 片段/标题里的 HTML 标签（如 <b>），避免原样渲染进聊天。 */
    static stripHtml(text) {
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /** 把 Outline API 返回的相对文档路径（如 /doc/xxx）解析为可点击的绝对地址。 */
    absolutize(url) {
        if (!url)
            return '';
        if (/^https?:\/\//i.test(url))
            return url;
        return `${this.baseUrl}${url.startsWith('/') ? url : '/' + url}`;
    }
    /** 请求并返回完整 JSON 响应体（data + pagination 等元数据）。 */
    async requestJson(path, body, retries = 0) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let response;
        try {
            response = await this.fetchImpl(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        }
        catch (error) {
            const aborted = error instanceof Error && error.name === 'AbortError';
            const cause = error instanceof Error ? error.message : String(error);
            throw new OutlineApiError('network', aborted
                ? `Outline 请求超时（${this.timeoutMs}ms）：${url}`
                : `无法连接 Outline（${url}）：${cause}。请确认 baseUrl 正确且网络可达。`);
        }
        finally {
            clearTimeout(timer);
        }
        const bodyText = await response.text().catch(() => '');
        if (!response.ok) {
            // 429 限流：指数退避自动重试（最多 3 次）；尊重 Retry-After，仍失败则抛出 rate-limited
            if (response.status === 429 && retries < OutlineClient.MAX_RETRIES) {
                const retryAfter = Number(response.headers?.get?.('retry-after') ?? '');
                const delay = Number.isFinite(retryAfter) && retryAfter >= 0
                    ? Math.min(retryAfter * 1000, 5000)
                    : Math.min(500 * 2 ** retries, 5000);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.requestJson(path, body, retries + 1);
            }
            throwForStatus(response.status, bodyText);
        }
        let json;
        try {
            json = JSON.parse(bodyText);
        }
        catch {
            throw new OutlineApiError('invalid-response', 'Outline 返回了无法解析的响应。');
        }
        return json;
    }
    async request(path, body) {
        const json = await this.requestJson(path, body);
        const data = json.data;
        if (data === undefined)
            throw new OutlineApiError('invalid-response', 'Outline 响应缺少 data 字段。');
        return data;
    }
    async searchDocuments(query, limit, collectionId, filters, offset = 0) {
        const json = await this.requestJson(`/api/documents.search`, {
            query,
            limit,
            ...(offset > 0 ? { offset } : {}),
            ...(collectionId !== undefined && collectionId !== '' ? { collectionId } : {}),
            ...(filters?.userId !== undefined && filters.userId !== '' ? { userId: filters.userId } : {}),
            ...(filters?.updatedAfter !== undefined && filters.updatedAfter !== '' ? { updatedAfter: filters.updatedAfter } : {}),
        });
        const data = Array.isArray(json.data) ? json.data : [];
        const pagination = (json.pagination ?? {});
        const hits = data.map((item) => {
            const record = (item ?? {});
            const document = (record.document ?? {});
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
            };
        });
        const total = typeof pagination.total === 'number' ? pagination.total : hits.length;
        return { total, hits };
    }
    /** 统计 Outline 知识库文档总数（documents.list 分页 total；不含已删除/回收站文档）。 */
    async countDocuments(filters = {}) {
        const json = await this.requestJson(`/api/documents.list`, { limit: 1, ...filters });
        const pagination = (json.pagination ?? {});
        return typeof pagination.total === 'number' ? pagination.total : 0;
    }
    /** 列出当前 token 可见的集合（短期缓存）。注：实例要求 collections.list 带查询串。 */
    async listCollections(force = false) {
        const cached = this.collectionsCache;
        if (!force && cached !== null && cached !== undefined && cached.expires > Date.now())
            return cached.collections;
        // Outline 分页：循环拉取直到收齐 pagination.total（防止集合数超过一页时漏集合）
        const collections = [];
        const pageSize = 100;
        for (let offset = 0;; offset += pageSize) {
            const json = await this.requestJson(`/api/collections.list?limit=${pageSize}&offset=${offset}`, {});
            const data = Array.isArray(json.data) ? json.data : [];
            for (const item of data) {
                const c = (item ?? {});
                collections.push({
                    id: typeof c.id === 'string' ? c.id : '',
                    name: typeof c.name === 'string' ? c.name : '(未命名集合)',
                    permission: typeof c.permission === 'string' ? c.permission : '',
                    ...(typeof c.documentCount === 'number' ? { documentCount: c.documentCount } : {}),
                });
            }
            const pagination = (json.pagination ?? {});
            const total = typeof pagination.total === 'number' ? pagination.total : collections.length;
            if (data.length === 0)
                break;
            if (collections.length >= total)
                break;
        }
        this.collectionsCache = { expires: Date.now() + this.cacheTtlMs, collections };
        return collections;
    }
    /** 在指定集合创建文档（默认发布；可指定父文档实现嵌套）。 */
    async createDocument(input) {
        const data = await this.request(`/api/documents.create`, {
            collectionId: input.collectionId,
            title: input.title,
            text: input.text,
            publish: input.publish ?? true,
            ...(input.parentDocumentId !== undefined && input.parentDocumentId !== '' ? { parentDocumentId: input.parentDocumentId } : {}),
        });
        // 新建后集合文档数变化，失效集合缓存
        this.collectionsCache = null;
        return {
            id: typeof data.id === 'string' ? data.id : '',
            url: this.absolutize(typeof data.url === 'string' ? data.url : ''),
            title: OutlineClient.stripHtml(typeof data.title === 'string' ? data.title : input.title),
            published: typeof data.published === 'boolean' ? data.published : true,
        };
    }
    /** 更新已有文档（至少提供 title 或 text 之一）。 */
    async updateDocument(id, input) {
        const payload = { id };
        if (input.title !== undefined && input.title !== '')
            payload.title = input.title;
        if (input.text !== undefined && input.text !== '')
            payload.text = input.text;
        const data = await this.request(`/api/documents.update`, payload);
        // 更新后清除该文档缓存，避免 60s 内读到旧内容
        this.docCache.delete(id);
        return {
            id: typeof data.id === 'string' ? data.id : id,
            url: this.absolutize(typeof data.url === 'string' ? data.url : ''),
            title: OutlineClient.stripHtml(typeof data.title === 'string' ? data.title : input.title ?? id),
            published: typeof data.published === 'boolean' ? data.published : true,
        };
    }
    /** 删除文档（本实例无回收站端点，为硬删；调用方必须已通过双重审批）。 */
    async deleteDocument(id) {
        // 本实例 delete 响应形如 {success:true, ok:true}，无 data 字段 → 用 requestJson 直接读
        const json = await this.requestJson(`/api/documents.delete`, { id });
        // 删除后清除文档缓存与集合缓存（文档数/可见性变化）
        this.docCache.delete(id);
        this.collectionsCache = null;
        return { success: json.success !== false };
    }
    async getDocument(id) {
        const cached = this.docCache.get(id);
        if (cached !== undefined && cached.expires > Date.now())
            return cached.doc;
        const data = await this.request(`/api/documents.info`, { id });
        const doc = {
            id: typeof data.id === 'string' ? data.id : id,
            title: OutlineClient.stripHtml(typeof data.title === 'string' ? data.title : '(无标题)'),
            url: this.absolutize(typeof data.url === 'string' ? data.url : ''),
            text: typeof data.text === 'string' ? data.text : '',
            updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
            ...(data.collectionId !== undefined && data.collectionId !== null ? { collectionId: String(data.collectionId) } : {}),
            ...(data.parentDocumentId !== undefined && data.parentDocumentId !== null
                ? { parentDocumentId: String(data.parentDocumentId) }
                : {}),
        };
        this.docCache.set(id, { expires: Date.now() + this.cacheTtlMs, doc });
        // 超限时淘汰最旧条目（Map 保持插入顺序）
        if (this.docCache.size > OutlineClient.DOC_CACHE_MAX_ENTRIES) {
            const oldest = this.docCache.keys().next().value;
            if (oldest !== undefined)
                this.docCache.delete(oldest);
        }
        return doc;
    }
    /** 列出某父文档下的直接子文档（用于路径定位；本地匹配名称，避免搜索分词歧义）。 */
    async listChildDocuments(parentDocumentId, pageSize = 100) {
        // Outline documents.list 分页：循环拉取直到收齐 total（防止子文档超过一页时漏项）
        const hits = [];
        for (let offset = 0;; offset += pageSize) {
            const json = await this.requestJson(`/api/documents.list`, {
                parentDocumentId,
                limit: pageSize,
                ...(offset > 0 ? { offset } : {}),
            });
            const data = Array.isArray(json.data) ? json.data : [];
            for (const item of data) {
                const d = (item ?? {});
                hits.push({
                    id: typeof d.id === 'string' ? d.id : '',
                    title: OutlineClient.stripHtml(typeof d.title === 'string' ? d.title : '(无标题)'),
                    url: this.absolutize(typeof d.url === 'string' ? d.url : ''),
                    snippet: '',
                    collectionId: typeof d.collectionId === 'string' ? d.collectionId : '',
                    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
                    ...(d.parentDocumentId !== undefined && d.parentDocumentId !== null ? { parentDocumentId: String(d.parentDocumentId) } : {}),
                });
            }
            const pagination = (json.pagination ?? {});
            const total = typeof pagination.total === 'number' ? pagination.total : hits.length;
            if (data.length === 0)
                break;
            if (hits.length >= total)
                break;
        }
        return hits;
    }
    /** 解析一个文档的完整路径：返回 [集合名, 顶级目录, …, 文档名]（自顶向下）。 */
    async resolveDocumentPath(docId) {
        const titles = [];
        let collectionId;
        let currentId = docId;
        const seen = new Set();
        while (currentId !== undefined && currentId !== '' && !seen.has(currentId)) {
            seen.add(currentId);
            const doc = await this.getDocument(currentId);
            collectionId ??= doc.collectionId;
            titles.unshift(doc.title);
            currentId = doc.parentDocumentId ?? '';
        }
        if (collectionId !== undefined) {
            const collections = await this.listCollections();
            const coll = collections.find((c) => c.id === collectionId);
            if (coll !== undefined)
                titles.unshift(coll.name);
        }
        return titles;
    }
}
