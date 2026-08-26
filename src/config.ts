import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** Outline 实例根地址，如 https://outline.example.com（不含尾斜杠） */
  baseUrl?: string
  /** Outline API token（设置 → API 密钥）；环境变量 OUTLINE_API_TOKEN 优先 */
  apiToken?: string
  /** HTTP 请求超时（毫秒） */
  timeoutMs: number
  /** outline_search 默认返回条数 */
  searchLimit: number
  /** 受保护集合名（逗号分隔），禁止在这些集合创建/更新/删除文档 */
  protectedCollections?: string
}

export const Config: Schema<Config> = Schema.object({
  baseUrl: Schema.string().description('Outline 实例根地址，如 https://outline.example.com'),
  apiToken: Schema.string().description('Outline API token；环境变量 OUTLINE_API_TOKEN 优先'),
  timeoutMs: Schema.number().min(1000).default(15000).description('HTTP 请求超时（毫秒）'),
  searchLimit: Schema.number().min(1).max(25).default(10).description('outline_search 默认返回条数'),
  protectedCollections: Schema.string().default('内部集合').description('受保护集合名（逗号分隔），禁止写入'),
})

export type { Context }