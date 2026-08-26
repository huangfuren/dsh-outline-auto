// 集成验证（真实 Outline 库）：
//   默认：settings 命名空间 → settings.yaml 落盘 → 真实 search + count 链路
//   --create：list_collections → 创建测试文档 → search 确认 → 自动清理
// 用法：OUTLINE_BASE_URL=... OUTLINE_API_TOKEN=... node scripts/verify.mjs [--create] [关键词]
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import * as plugin from '../lib/index.js'

const args = process.argv.slice(2)
const createMode = args.includes('--create')
const KEYWORD = args.find((a) => !a.startsWith('--')) ?? '新人'

// 凭据走环境变量，避免把 token 写进仓库（均必填）
const BASE_URL = process.env.OUTLINE_BASE_URL
const API_TOKEN = process.env.OUTLINE_API_TOKEN
if (!BASE_URL || !API_TOKEN) {
  console.error('缺少 OUTLINE_BASE_URL / OUTLINE_API_TOKEN 环境变量（真实验证需要）')
  process.exit(2)
}
const MARK = `TEST-插件集成验证-${Date.now()}`

async function waitFor(predicate, label, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timeout: ${label}`)
}

const tmpHome = mkdtempSync(join(tmpdir(), 'dsh-outline-verify-'))
const ctx = new Context()
const tools = []
ctx.provide('tools', { register: (tool) => { tools.push(tool) } })
let createdId = null

try {
  ctx.plugin(FileSettingsProvider, { dshHome: tmpHome, watch: false })
  ctx.plugin(plugin, {})
  await waitFor(() => ctx.settings?.get('outline-auto') !== undefined, 'settings ns')
  await ctx.settings.update('outline-auto', { baseUrl: BASE_URL, apiToken: API_TOKEN })
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))

  if (createMode) {
    // —— 创建链路（真实写，自动清理）——
    const collections = await byName.outline_list_collections.execute({}, {})
    console.log(`[1] 可见集合 ${collections.length} 个：`, collections.slice(0, 5).map((c) => `${c.name}(${c.permission})`).join(', '))
    const target = collections.find((c) => c.permission === 'read_write' || c.permission === 'manage') ?? collections[0]
    if (!target) throw new Error('无可见集合')
    const created = await byName.outline_create.execute({ collectionId: target.id, title: MARK, text: `# ${MARK}\n\n集成验证正文。`, publish: true }, {})
    createdId = created.id
    console.log(`[2] 已创建: ${created.title} → ${created.url}`)
    const found = await byName.outline_search.execute({ query: MARK, limit: 5 }, {})
    console.log(`[3] 检索确认命中: ${found.total} 篇`)
    if (found.total < 1) throw new Error('创建后检索不到')
    console.log('CREATE INTEGRATION PASS')
  } else {
    // —— 读取链路（settings → search → count）——
    const docPath = join(tmpHome, 'settings.yaml')
    const doc = readFileSync(docPath, 'utf8')
    console.log('[1] settings.yaml 已落盘：\n' + doc.trim())
    const searchTool = tools.find((tool) => tool.name === 'outline_search')
    const countTool = tools.find((tool) => tool.name === 'outline_count')
    if (!searchTool || !countTool) throw new Error('outline_search / outline_count 工具未注册')
    const result = await searchTool.execute({ query: KEYWORD, limit: 3 }, {})
    const hits = Array.isArray(result.hits) ? result.hits : []
    console.log(`[2] outline_search("${KEYWORD}") 返回 ${hits.length} 条（匹配总数 ${result.total}）：`)
    for (const hit of hits.slice(0, 3)) console.log(`    - ${hit.title}  ${hit.url}`)
    const counted = await countTool.execute({}, {})
    console.log(`[3] outline_count 文档总数: ${counted.total}`)
    console.log('INTEGRATION PASS')
  }
} finally {
  // 清理：删除 --create 链路创建的测试文档（本实例 documents.delete 可用；moveToTrash 可能 404，跳过）
  if (createdId) {
    try {
      const del = await fetch(`${BASE_URL}/api/documents.delete`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: createdId }),
      })
      console.log('[cleanup] delete:', del.status)
    } catch (e) { console.error('[cleanup] 失败:', e.message) }
  }
  try { await ctx.stop?.() } catch { /* ignore */ }
  rmSync(tmpHome, { recursive: true, force: true })
}
