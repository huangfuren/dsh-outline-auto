// 集成验证：list_collections（真实读）→ createDocument（真实写，标题带 TEST 前缀）→ search 确认 → 清理
// 用法：OUTLINE_BASE_URL=... OUTLINE_API_TOKEN=... node scripts/verify-create.mjs
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import * as plugin from '../lib/index.js'

const BASE_URL = process.env.OUTLINE_BASE_URL
const API_TOKEN = process.env.OUTLINE_API_TOKEN
if (!BASE_URL || !API_TOKEN) { console.error('缺少 OUTLINE_BASE_URL / OUTLINE_API_TOKEN'); process.exit(2) }
const MARK = `TEST-插件集成验证-${Date.now()}`

async function waitFor(predicate, label, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`timeout: ${label}`)
}

const tmpHome = mkdtempSync(join(tmpdir(), 'dsh-outline-create-int-'))
const ctx = new Context()
const tools = []
ctx.provide('tools', { register: (t) => tools.push(t) })
let createdId = null
try {
  ctx.plugin(FileSettingsProvider, { dshHome: tmpHome, watch: false })
  ctx.plugin(plugin, {})
  await waitFor(() => ctx.settings?.get('outline-auto') !== undefined, 'settings ns')
  await ctx.settings.update('outline-auto', { baseUrl: BASE_URL, apiToken: API_TOKEN })
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
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
} finally {
  // 清理：直接调 API 删除测试文档（本实例 documents.delete 可用；moveToTrash 可能 404，跳过）
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
