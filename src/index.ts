import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import { OutlineClient } from './client.js'
import { outlineSearchTool, outlineGetDocumentTool } from './tools.js'

export const name = 'dsh-outline-ai'
export const inject = ['tools']

export function apply(ctx: Context, config: Config = {} as Config) {
  const makeClient = () => {
    const baseUrl = (config.baseUrl ?? '').trim() || (process.env.OUTLINE_BASE_URL ?? '').trim()
    const apiToken = (process.env.OUTLINE_API_TOKEN ?? '').trim() || (config.apiToken ?? '').trim()
    if (!baseUrl || !apiToken) {
      throw new Error(
        'dsh-outline-ai 未配置：需要 baseUrl（插件行 config.baseUrl 或环境变量 OUTLINE_BASE_URL）与 apiToken（环境变量 OUTLINE_API_TOKEN 或 config.apiToken）。配置方法见插件 README。',
      )
    }
    return new OutlineClient({ baseUrl, apiToken, timeoutMs: config.timeoutMs ?? 15000 })
  }
  ctx.tools.register(outlineSearchTool(makeClient, config.searchLimit ?? 10))
  ctx.tools.register(outlineGetDocumentTool(makeClient))
}