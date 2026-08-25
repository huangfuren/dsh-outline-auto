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
}
export declare const Config: Schema<Config>;
export type { Context };
