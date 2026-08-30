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
  /** 可写目录路径（逗号分隔）：仅这些目录及其全部子级允许创建/更新/删除文档；留空 = 全库只读（默认） */
  writablePaths?: string
}

export const Config: Schema<Config> = Schema.object({
  baseUrl: Schema.string().description('Outline 实例根地址，如 https://outline.example.com'),
  apiToken: Schema.string().description('Outline API token；环境变量 OUTLINE_API_TOKEN 优先'),
  timeoutMs: Schema.number().min(1000).default(15000).description('HTTP 请求超时（毫秒）'),
  searchLimit: Schema.number().min(1).max(25).default(10).description('outline_search 默认返回条数'),
  writablePaths: Schema.string().default('').description('可写目录路径（逗号分隔），如 集合A,集合B/目录1；留空 = 全库只读（默认）'),
})

export type { Context }
