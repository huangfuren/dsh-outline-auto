import { createMockOutlineServer } from './mock-outline-server.mjs'
import { apply } from '../lib/index.js'

const server = createMockOutlineServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const baseUrl = `http://127.0.0.1:${port}`

const tools = []
const ctx = { tools: { register: (definition) => { tools.push(definition) } } }
apply(ctx, { baseUrl, apiToken: 'test-token', timeoutMs: 5000, searchLimit: 5 })
const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
const exec = {}
let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) failures++ }

try {
  const hits = await byName.outline_search.execute({ query: '部署', limit: 3 }, exec)
  check('outline_search 返回结果', Array.isArray(hits) && hits.length === 1 && hits[0].id === 'doc-1', JSON.stringify(hits))
  const empty = await byName.outline_search.execute({ query: '不存在的词', limit: 3 }, exec)
  check('outline_search 空结果', Array.isArray(empty) && empty.length === 0)
  const doc = await byName.outline_get_document.execute({ id: 'doc-1' }, exec)
  check('outline_get_document 全文', typeof doc.text === 'string' && doc.text.includes('# 部署规范'))
  const trunc = await byName.outline_get_document.execute({ id: 'doc-1', maxLength: 1000 }, exec)
  check('outline_get_document 截断', trunc.truncated === false || trunc.text.length <= 1000)
  let notFound = false
  try { await byName.outline_get_document.execute({ id: 'missing' }, exec) } catch (e) { notFound = e.kind === 'not-found' }
  check('outline_get_document 404', notFound)
} catch (error) {
  console.error('SMOKE ERROR:', error)
  failures++
}

await new Promise((resolve) => server.close(resolve))
if (failures > 0) { console.error(`SMOKE FAILED (${failures})`); process.exit(1) }
console.log('SMOKE PASS')