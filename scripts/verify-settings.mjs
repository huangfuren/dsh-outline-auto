// 集成验证：settings 命名空间注册 → 写入（模拟 GUI 卡片保存）→ settings.yaml 落盘
// → 插件 makeClient 读取 → 真实 outline_search 端到端。
// 用法：node scripts/verify-settings.mjs [关键词]
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import * as plugin from '../lib/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const KEYWORD = process.argv[2] ?? '新人'
// 凭据走环境变量，避免把 token 写进仓库：OUTLINE_BASE_URL / OUTLINE_API_TOKEN（均必填）
const BASE_URL = process.env.OUTLINE_BASE_URL
const API_TOKEN = process.env.OUTLINE_API_TOKEN
if (!BASE_URL || !API_TOKEN) {
  console.error('缺少 OUTLINE_BASE_URL / OUTLINE_API_TOKEN 环境变量（真实搜索步骤需要）')
  process.exit(2)
}

async function waitFor(predicate, label, timeoutMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`timeout waiting for ${label}`)
}

const tmpHome = mkdtempSync(join(tmpdir(), 'dsh-outline-int-'))
const ctx = new Context()
const tools = []
ctx.provide('tools', { register: (tool) => { tools.push(tool) } })

try {
  ctx.plugin(FileSettingsProvider, { dshHome: tmpHome, watch: false })
  ctx.plugin(plugin, {})

  await waitFor(() => ctx.settings?.get('outline-ai') !== undefined, 'settings namespace registration')
  console.log('[1] 命名空间已注册，解析值 =', JSON.stringify(ctx.settings.get('outline-ai')))

  // 模拟 GUI 卡片保存：写入用户层
  await ctx.settings.update('outline-ai', {
    baseUrl: BASE_URL,
    apiToken: API_TOKEN,
  })

  const docPath = join(tmpHome, 'settings.yaml')
  const doc = readFileSync(docPath, 'utf8')
  console.log('[2] settings.yaml 已落盘：\n' + doc.trim())

  const searchTool = tools.find((tool) => tool.name === 'outline_search')
  if (!searchTool) throw new Error('outline_search 工具未注册')
  const result = await searchTool.execute({ query: KEYWORD, limit: 3 }, {})
  const hits = Array.isArray(result) ? result : [result]
  console.log(`[3] outline_search("${KEYWORD}") 返回 ${hits.length} 条：`)
  for (const hit of hits.slice(0, 3)) console.log(`    - ${hit.title}  ${hit.url}`)
  console.log('INTEGRATION PASS')
} finally {
  try { await ctx.stop?.() } catch { /* ignore */ }
  rmSync(tmpHome, { recursive: true, force: true })
}
