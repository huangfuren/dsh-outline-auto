import { createMockOutlineServer } from './mock-outline-server.mjs'
import { apply } from '../lib/index.js'

// 冒烟必须自包含：清掉环境变量，避免环境里的 OUTLINE_* 盖过下方 config（优先级 GUI > env > config）。
delete process.env.OUTLINE_BASE_URL
delete process.env.OUTLINE_API_TOKEN

const server = createMockOutlineServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const baseUrl = `http://127.0.0.1:${port}`

const tools = []
// 冒烟只测工具链路，不涉及 settings 服务：ctx.inject 给个空实现，
// 使 installSettingsSection 静默跳过（settingsSource 保持默认，走 config/env）。
const ctx = {
  tools: { register: (definition) => { tools.push(definition) } },
  inject: () => () => {},
  on: () => () => {},
}
apply(ctx, { baseUrl, apiToken: 'test-token', timeoutMs: 5000, searchLimit: 5 })
const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
const exec = {}
let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) failures++ }

try {
  const search = await byName.outline_search.execute({ query: '部署', limit: 3 }, exec)
  check('outline_search 返回结果', Array.isArray(search.hits) && search.hits.length === 1 && search.hits[0].id === 'doc-1', JSON.stringify(search))
  check('outline_search 匹配总数', search.total === 1)
  const empty = await byName.outline_search.execute({ query: '不存在的词', limit: 3 }, exec)
  check('outline_search 空结果', Array.isArray(empty.hits) && empty.hits.length === 0)
  const doc = await byName.outline_get_document.execute({ id: 'doc-1' }, exec)
  check('outline_get_document 全文', typeof doc.text === 'string' && doc.text.includes('# 部署规范'))
  const trunc = await byName.outline_get_document.execute({ id: 'doc-1', maxLength: 1000 }, exec)
  check('outline_get_document 截断', trunc.truncated === false || trunc.text.length <= 1000)
  let notFound = false
  try { await byName.outline_get_document.execute({ id: 'missing' }, exec) } catch (e) { notFound = e.kind === 'not-found' }
  check('outline_get_document 404', notFound)
  const count = await byName.outline_count.execute({}, exec)
  check('outline_count 文档总数', count.total === 3, JSON.stringify(count))
  const collections = await byName.outline_list_collections.execute({}, exec)
  check('outline_list_collections 返回集合', Array.isArray(collections) && collections.length === 1 && collections[0].id === 'col-1', JSON.stringify(collections))
  const created = await byName.outline_create.execute({ collectionId: 'col-1', title: '冒烟测试文档', text: '# 冒烟\n正文' }, exec)
  check('outline_create 创建成功', created.published === true && String(created.id).startsWith('new-'), JSON.stringify(created))
  const recheck = await byName.outline_count.execute({}, exec)
  check('outline_count 创建后 +1', recheck.total === 4)
} catch (error) {
  console.error('SMOKE ERROR:', error)
  failures++
}

await new Promise((resolve) => server.close(resolve))
if (failures > 0) { console.error(`SMOKE FAILED (${failures})`); process.exit(1) }
console.log('SMOKE PASS')