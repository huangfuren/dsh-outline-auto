import { describe, it, expect } from 'vitest'
import { OutlineClient } from '../src/client.js'
import { OutlineApiError } from '../src/errors.js'

type StubResponse = { status: number; body: unknown }

function stubFetch(handler: (url: string, init: RequestInit) => Promise<StubResponse>): typeof fetch {
  return (async (url: any, init: any) => {
    const r = await handler(String(url), init as RequestInit)
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => JSON.stringify(r.body),
    } as unknown as Response
  }) as typeof fetch
}

const SEARCH_BODY = {
  data: [
    {
      context: '部署规范相关片段',
      document: { id: 'doc-1', title: '部署规范', url: '/doc/deploy', collectionId: 'col-1', updatedAt: '2026-01-01T00:00:00Z' },
    },
  ],
  pagination: {},
}

const INFO_BODY = {
  data: { id: 'doc-1', title: '部署规范', url: '/doc/deploy', text: '# 部署\n\n步骤…', updatedAt: '2026-01-01T00:00:00Z' },
}

describe('OutlineClient', () => {
  it('searchDocuments 解析 data[].document 并保留 context 片段', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com/',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (url, init) => {
        expect(url).toBe('https://outline.example.com/api/documents.search')
        expect(init.method).toBe('POST')
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
        expect(JSON.parse(String(init.body))).toEqual({ query: '部署', limit: 5 })
        return { status: 200, body: SEARCH_BODY }
      }),
    })
    const hits = await client.searchDocuments('部署', 5)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ id: 'doc-1', title: '部署规范', snippet: '部署规范相关片段' })
  })

  it('searchDocuments 空结果返回空数组', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: { data: [] } })),
    })
    expect(await client.searchDocuments('xyz', 10)).toEqual([])
  })

  it('getDocument 返回 Markdown 全文', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: INFO_BODY })),
    })
    const doc = await client.getDocument('doc-1')
    expect(doc).toMatchObject({ id: 'doc-1', title: '部署规范', text: '# 部署\n\n步骤…' })
  })

  it('401 映射为 auth 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 401, body: { ok: false } })),
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'auth' })
  })

  it('404 映射为 not-found 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 404, body: {} })),
    })
    await expect(client.getDocument('nope')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('429 映射为 rate-limited 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 429, body: {} })),
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'rate-limited' })
  })

  it('网络失败映射为 network 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: (async () => { throw new TypeError('fetch failed') }) as typeof fetch,
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'network' })
  })

  it('响应缺 data 字段抛 invalid-response', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: { nope: 1 } })),
    })
    await expect(client.searchDocuments('x', 1)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('OutlineApiError 是 Error 实例', () => {
    const err = new OutlineApiError('network', 'boom')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('boom')
  })
})