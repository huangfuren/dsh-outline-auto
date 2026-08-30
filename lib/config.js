import Schema from '@deepseek-ai/schemastery';
export const Config = Schema.object({
    baseUrl: Schema.string().description('Outline 实例根地址，如 https://outline.example.com'),
    apiToken: Schema.string().description('Outline API token；环境变量 OUTLINE_API_TOKEN 优先'),
    timeoutMs: Schema.number().min(1000).default(15000).description('HTTP 请求超时（毫秒）'),
    searchLimit: Schema.number().min(1).max(25).default(10).description('outline_search 默认返回条数'),
    writablePaths: Schema.string().default('').description('可写目录路径（逗号分隔），如 集合A,集合B/目录1；留空 = 全库只读（默认）'),
});
