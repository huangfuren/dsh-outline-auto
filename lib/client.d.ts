export interface OutlineSearchHit {
    id: string;
    title: string;
    url: string;
    snippet: string;
    collectionId: string;
    updatedAt: string;
}
export interface OutlineDocument {
    id: string;
    title: string;
    url: string;
    text: string;
    updatedAt: string;
}
export interface OutlineClientOptions {
    baseUrl: string;
    apiToken: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}
export declare class OutlineClient {
    private readonly fetchImpl;
    private readonly timeoutMs;
    private readonly baseUrl;
    private readonly apiToken;
    /** getDocument 的短期缓存（key = 文档 id），避免会话内重复读取同一文档反复请求 API。 */
    private readonly docCache;
    private static readonly DOC_CACHE_TTL_MS;
    constructor(options: OutlineClientOptions);
    /** 去掉 Outline 片段/标题里的 HTML 标签（如 <b>），避免原样渲染进聊天。 */
    private static stripHtml;
    /** 把 Outline API 返回的相对文档路径（如 /doc/xxx）解析为可点击的绝对地址。 */
    private absolutize;
    private request;
    searchDocuments(query: string, limit: number): Promise<OutlineSearchHit[]>;
    getDocument(id: string): Promise<OutlineDocument>;
}
