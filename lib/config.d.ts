import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export interface Config {
    /** Outline 实例根地址，如 https://outline.example.com（不含尾斜杠） */
    baseUrl?: string;
    /** Outline API token（设置 → API 密钥）；环境变量 OUTLINE_API_TOKEN 优先 */
    apiToken?: string;
    /** HTTP 请求超时（毫秒） */
    timeoutMs: number;
    /** outline_search 默认返回条数 */
    searchLimit: number;
    /** 受保护集合名（逗号分隔），禁止在这些集合创建/更新/删除文档；默认不包含任何组织专属名称 */
    protectedCollections?: string;
}
export declare const Config: Schema<Config>;
export type { Context };
