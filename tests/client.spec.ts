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

  it('相对文档 url 被解析为可点击的绝对地址', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com/',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: SEARCH_BODY })),
    })
    const [hit] = await client.searchDocuments('部署', 5)
    expect(hit.url).toBe('https://outline.example.com/doc/deploy')

    const infoClient = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: INFO_BODY })),
    })
    const doc = await infoClient.getDocument('doc-1')
    expect(doc.url).toBe('https://outline.example.com/doc/deploy')
  })

  it('已是绝对地址的 url 保持不变', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({
        status: 200,
        body: {
          data: [
            {
              context: '',
              document: { id: 'doc-1', title: 'T', url: 'https://outline.other.com/doc/x', collectionId: 'c', updatedAt: '2026-01-01T00:00:00Z' },
            },
          ],
        },
      })),
    })
    const [hit] = await client.searchDocuments('部署', 5)
    expect(hit.url).toBe('https://outline.other.com/doc/x')
  })

  it('snippet 与标题中的 HTML 标签会被清理', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({
        status: 200,
        body: {
          data: [
            {
              context: 'TDD的本质：<b>测试</b>不是&nbsp;验证代码，而是设计代码',
              document: { id: 'doc-1', title: '<b>部署</b>规范', url: '/doc/deploy', collectionId: 'c', updatedAt: '2026-01-01T00:00:00Z' },
            },
          ],
        },
      })),
    })
    const [hit] = await client.searchDocuments('部署', 5)
    expect(hit.snippet).toBe('TDD的本质：测试不是 验证代码，而是设计代码')
    expect(hit.title).toBe('部署规范')
  })

  it('getDocument 对同一文档走短期缓存，不重复请求', async () => {
    let calls = 0
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => {
        calls += 1
        return { status: 200, body: INFO_BODY }
      }),
    })
    const first = await client.getDocument('doc-1')
    const second = await client.getDocument('doc-1')
    expect(first.title).toBe('部署规范')
    expect(second).toEqual(first)
    expect(calls).toBe(1)
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