export interface OutlineSearchHit {
    id: string;
    title: string;
    url: string;
    snippet: string;
    collectionId: string;
    updatedAt: string;
    parentDocumentId?: string;
}
/** 搜索结果：命中列表 + 该关键词在知识库中的匹配总数（pagination.total）。 */
export interface OutlineSearchResult {
    total: number;
    hits: OutlineSearchHit[];
}
export interface OutlineDocument {
    id: string;
    title: string;
    url: string;
    text: string;
    updatedAt: string;
    collectionId?: string;
    parentDocumentId?: string;
}
/** Outline 集合（collections.list 条目）。documentCount 部分实例可能不返回。 */
export interface OutlineCollection {
    id: string;
    name: string;
    permission: string;
    documentCount?: number;
}
/** outline_create 返回：创建后的文档信息。 */
export interface OutlineCreateResult {
    id: string;
    url: string;
    title: string;
    published: boolean;
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
    /** listCollections 的短期缓存，供审批钩子解析集合名。 */
    private collectionsCache;
    constructor(options: OutlineClientOptions);
    /** 去掉 Outline 片段/标题里的 HTML 标签（如 <b>），避免原样渲染进聊天。 */
    private static stripHtml;
    /** 把 Outline API 返回的相对文档路径（如 /doc/xxx）解析为可点击的绝对地址。 */
    private absolutize;
    /** 请求并返回完整 JSON 响应体（data + pagination 等元数据）。 */
    private requestJson;
    private request;
    searchDocuments(query: string, limit: number, collectionId?: string): Promise<OutlineSearchResult>;
    /** 统计 Outline 知识库文档总数（documents.list 分页 total；不含已删除/回收站文档）。 */
    countDocuments(filters?: Record<string, unknown>): Promise<number>;
    /** 列出当前 token 可见的集合（60s 缓存）。注：实例要求 collections.list 带查询串。 */
    listCollections(force?: boolean): Promise<OutlineCollection[]>;
    /** 在指定集合创建文档（默认发布；可指定父文档实现嵌套）。 */
    createDocument(input: {
        collectionId: string;
        title: string;
        text: string;
        publish?: boolean;
        parentDocumentId?: string;
    }): Promise<OutlineCreateResult>;
    getDocument(id: string): Promise<OutlineDocument>;
    /** 列出某父文档下的直接子文档（用于路径定位；本地匹配名称，避免搜索分词歧义）。 */
    listChildDocuments(parentDocumentId: string, limit?: number): Promise<OutlineSearchHit[]>;
    /** 解析一个文档的完整路径：返回 [集合名, 顶级目录, …, 文档名]（自顶向下）。 */
    resolveDocumentPath(docId: string): Promise<string[]>;
}
