import Schema from '@deepseek-ai/schemastery';
export const Config = Schema.object({
    baseUrl: Schema.string().description('Outline 实例根地址，如 https://outline.example.com'),
    apiToken: Schema.string().description('Outline API token；环境变量 OUTLINE_API_TOKEN 优先'),
    timeoutMs: Schema.number().min(1000).default(15000).description('HTTP 请求超时（毫秒）'),
    searchLimit: Schema.number().min(1).max(25).default(10).description('outline_search 默认返回条数'),
    protectedCollections: Schema.string().default('').description('受保护集合名（逗号分隔），禁止写入；默认无组织专属名称'),
});
