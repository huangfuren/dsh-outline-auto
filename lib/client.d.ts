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
    constructor(options: OutlineClientOptions);
    private request;
    searchDocuments(query: string, limit: number): Promise<OutlineSearchHit[]>;
    getDocument(id: string): Promise<OutlineDocument>;
}
