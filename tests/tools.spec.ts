import { describe, it, expect } from 'vitest'
import { outlineSearchTool, outlineGetDocumentTool } from '../src/tools.js'
import { OutlineApiError } from '../src/errors.js'
import type { OutlineClient } from '../src/client.js'

function fakeClient(overrides: Partial<OutlineClient> = {}): OutlineClient {
  return {
    searchDocuments: async (query: string) => [{ id: 'doc-1', title: query, url: '/d', snippet: 's', collectionId: '', updatedAt: '' }],
    getDocument: async (id: string) => ({ id, title: 'T', url: '/d', text: 'body', updatedAt: '' }),
    ...overrides,
  } as unknown as OutlineClient
}

const exec = {} as never

describe('outline_search', () => {
  it('execute 返回归一化结果', async () => {
    const tool = outlineSearchTool(() => fakeClient(), 10)
    const result = await tool.execute({ query: '部署' }, exec)
    expect(result).toHaveLength(1)
    expect((result as any)[0].id).toBe('doc-1')
  })

  it('limit 超界被钳制', async () => {
    let seen = 0
    const tool = outlineSearchTool(() => fakeClient({ searchDocuments: async (_q, limit) => { seen = limit; return [] } }), 10)
    await tool.execute({ query: 'x', limit: 999 }, exec)
    expect(seen).toBe(25)
  })

  it('未配置时抛出中文配置错误', async () => {
    const tool = outlineSearchTool(() => { throw new Error('dsh-outline-kb 未配置：…') }, 10)
    await expect(tool.execute({ query: 'x' }, exec)).rejects.toThrow('未配置')
  })
})

describe('outline_get_document', () => {
  it('execute 返回全文并按 maxLength 截断', async () => {
    const tool = outlineGetDocumentTool(() => fakeClient({ getDocument: async () => ({ id: 'd', title: 'T', url: '/d', text: 'a'.repeat(3000), updatedAt: '' }) }))
    const result = await tool.execute({ id: 'd', maxLength: 1000 }, exec) as any
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(1000)
  })

  it('文档缺失透传 not-found 错误', async () => {
    const tool = outlineGetDocumentTool(() => fakeClient({ getDocument: async () => { throw new OutlineApiError('not-found', 'Outline 文档不存在或无权访问（HTTP 404）：请确认文档 id 是否正确。', 404) } }))
    await expect(tool.execute({ id: 'nope' }, exec)).rejects.toMatchObject({ kind: 'not-found' })
  })
})