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
    /** 可写目录路径（逗号分隔）：仅这些目录及其全部子级允许创建/更新/删除文档；留空 = 全库只读（默认） */
    writablePaths?: string;
    /** 读取缓存有效期（毫秒），默认 60000，范围 1000~300000 */
    cacheTtlMs?: number;
    /** 本地保存目录：把搜索结果/文档存为 Markdown 文件的位置；留空 = $DSH_HOME/outline-auto-saves */
    localSaveDir?: string;
    /** 同义词/别名表（原词 → 替换词列表）：搜索零命中时自动用替换词重试。例：{ "部署": ["上线", "发布"] } */
    synonyms?: Record<string, string[]>;
}
export declare const Config: Schema<Config>;
export type { Context };
