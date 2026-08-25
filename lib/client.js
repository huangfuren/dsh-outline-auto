import { OutlineApiError, throwForStatus } from './errors.js';
export class OutlineClient {
    fetchImpl;
    timeoutMs;
    baseUrl;
    apiToken;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.apiToken = options.apiToken;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
        this.timeoutMs = options.timeoutMs ?? 15000;
    }
    async request(path, body) {
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
        if (!response.ok)
            throwForStatus(response.status, bodyText);
        let json;
        try {
            json = JSON.parse(bodyText);
        }
        catch {
            throw new OutlineApiError('invalid-response', 'Outline 返回了无法解析的响应。');
        }
        const data = json.data;
        if (data === undefined)
            throw new OutlineApiError('invalid-response', 'Outline 响应缺少 data 字段。');
        return data;
    }
    async searchDocuments(query, limit) {
        const data = await this.request(`/api/documents.search`, { query, limit });
        return data.map((item) => {
            const record = (item ?? {});
            const document = (record.document ?? {});
            return {
                id: typeof document.id === 'string' ? document.id : '',
                title: typeof document.title === 'string' ? document.title : '(无标题)',
                url: typeof document.url === 'string' ? document.url : '',
                snippet: typeof record.context === 'string' ? record.context : '',
                collectionId: typeof document.collectionId === 'string' ? document.collectionId : '',
                updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : '',
            };
        });
    }
    async getDocument(id) {
        const data = await this.request(`/api/documents.info`, { id });
        return {
            id: typeof data.id === 'string' ? data.id : id,
            title: typeof data.title === 'string' ? data.title : '(无标题)',
            url: typeof data.url === 'string' ? data.url : '',
            text: typeof data.text === 'string' ? data.text : '',
            updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
        };
    }
}
