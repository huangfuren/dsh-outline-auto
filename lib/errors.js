export class OutlineApiError extends Error {
    kind;
    status;
    constructor(kind, message, status = null) {
        super(message);
        this.name = 'OutlineApiError';
        this.kind = kind;
        this.status = status;
    }
}
export function throwForStatus(status, bodyText) {
    const detail = bodyText.slice(0, 200);
    switch (status) {
        case 401:
        case 403:
            throw new OutlineApiError('auth', `Outline API 认证失败（HTTP ${status}）：请检查 apiToken 是否有效且有权访问。响应：${detail}`, status);
        case 404:
            throw new OutlineApiError('not-found', 'Outline 文档不存在或无权访问（HTTP 404）：请确认文档 id 是否正确。', status);
        case 429:
            throw new OutlineApiError('rate-limited', 'Outline API 触发限流（HTTP 429）：请稍后重试。', status);
        default:
            throw new OutlineApiError('api', `Outline API 请求失败（HTTP ${status}）：${detail}`, status);
    }
}
