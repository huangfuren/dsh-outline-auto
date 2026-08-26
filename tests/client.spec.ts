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
    const { total, hits } = await client.searchDocuments('部署', 5)
    expect(hits).toHaveLength(1)
    expect(total).toBe(1) // pagination 缺省时回退为命中数
    expect(hits[0]).toMatchObject({ id: 'doc-1', title: '部署规范', snippet: '部署规范相关片段' })
  })

  it('searchDocuments 空结果返回空 hits，total 为 0', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: { data: [] } })),
    })
    expect(await client.searchDocuments('xyz', 10)).toEqual({ total: 0, hits: [] })
  })

  it('searchDocuments 从 pagination.total 返回关键词匹配总数', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({
        status: 200,
        body: { ...SEARCH_BODY, pagination: { total: 20399 } },
      })),
    })
    const { total, hits } = await client.searchDocuments('部署', 5)
    expect(total).toBe(20399)
    expect(hits).toHaveLength(1)
  })

  it('countDocuments 返回 documents.list 的文档总数', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (url, init) => {
        expect(url).toBe('https://outline.example.com/api/documents.list')
        expect(JSON.parse(String(init.body))).toEqual({ limit: 1 })
        return { status: 200, body: { data: [{ id: 'd' }], pagination: { total: 20399 } } }
      }),
    })
    expect(await client.countDocuments()).toBe(20399)
  })

  it('相对文档 url 被解析为可点击的绝对地址', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com/',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 200, body: SEARCH_BODY })),
    })
    const { hits } = await client.searchDocuments('部署', 5)
    const [hit] = hits
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
    const { hits } = await client.searchDocuments('部署', 5)
    const [hit] = hits
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
    const { hits } = await client.searchDocuments('部署', 5)
    const [hit] = hits
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
    await expect(client.getDocument('x')).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('OutlineApiError 是 Error 实例', () => {
    const err = new OutlineApiError('network', 'boom')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('boom')
  })

  it('listCollections 映射集合字段', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({
        status: 200,
        body: { data: [{ id: 'col-1', name: '测试集合', permission: 'read_write', documentCount: 42 }] },
      })),
    })
    const collections = await client.listCollections()
    expect(collections).toEqual([{ id: 'col-1', name: '测试集合', permission: 'read_write', documentCount: 42 }])
  })

  it('createDocument 默认 publish=true 且 URL 绝对化', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (url, init) => {
        expect(url).toBe('https://outline.example.com/api/documents.create')
        expect(JSON.parse(String(init.body))).toEqual({ collectionId: 'col-1', title: 'T', text: 'B', publish: true })
        return { status: 200, body: { data: { id: 'd1', title: 'T', url: '/doc/d1', published: true } } }
      }),
    })
    const doc = await client.createDocument({ collectionId: 'col-1', title: 'T', text: 'B' })
    expect(doc).toMatchObject({ id: 'd1', url: 'https://outline.example.com/doc/d1', published: true })
  })

  it('createDocument 支持 publish=false 存草稿', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (_url, init) => {
        expect(JSON.parse(String(init.body))).toMatchObject({ publish: false })
        return { status: 200, body: { data: { id: 'd2', title: 'D', url: '/doc/d2', published: false } } }
      }),
    })
    const doc = await client.createDocument({ collectionId: 'col-1', title: 'D', text: 'B', publish: false })
    expect(doc.published).toBe(false)
  })

  it('createDocument 403 映射为 auth 错误', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async () => ({ status: 403, body: { ok: false } })),
    })
    await expect(client.createDocument({ collectionId: 'c', title: 'T', text: 'B' }))
      .rejects.toMatchObject({ kind: 'auth' })
  })

  it('updateDocument 携带 id 与变更字段', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (url, init) => {
        expect(url).toBe('https://outline.example.com/api/documents.update')
        expect(JSON.parse(String(init.body))).toEqual({ id: 'd1', title: '新标题' })
        return { status: 200, body: { data: { id: 'd1', title: '新标题', url: '/doc/d1', published: true } } }
      }),
    })
    const doc = await client.updateDocument('d1', { title: '新标题' })
    expect(doc).toMatchObject({ id: 'd1', title: '新标题', url: 'https://outline.example.com/doc/d1' })
  })

  it('deleteDocument 调用删除端点', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (url, init) => {
        expect(url).toBe('https://outline.example.com/api/documents.delete')
        expect(JSON.parse(String(init.body))).toEqual({ id: 'd1' })
        return { status: 200, body: { data: { id: 'd1', success: true } } }
      }),
    })
    expect(await client.deleteDocument('d1')).toEqual({ success: true })
  })

  it('searchDocuments 透传 userId/updatedAfter（顶层参数）', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (_url, init) => {
        expect(JSON.parse(String(init.body))).toEqual({
          query: 'x', limit: 5, collectionId: 'c1', userId: 'u1',
          updatedAfter: '2026-08-01',
        })
        return { status: 200, body: { data: [], pagination: { total: 0 } } }
      }),
    })
    const r = await client.searchDocuments('x', 5, 'c1', { userId: 'u1', updatedAfter: '2026-08-01' })
    expect(r.total).toBe(0)
  })

  it('searchDocuments 支持 collectionId 过滤并映射 parentDocumentId', async () => {
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (_url, init) => {
        expect(JSON.parse(String(init.body))).toEqual({ query: 'x', limit: 5, collectionId: 'col-1' })
        return {
          status: 200,
          body: {
            data: [{ context: '', document: { id: 'd', title: 'T', url: '/doc/d', collectionId: 'col-1', parentDocumentId: 'p-1', updatedAt: '' } }],
            pagination: { total: 1 },
          },
        }
      }),
    })
    const { hits } = await client.searchDocuments('x', 5, 'col-1')
    expect(hits[0].parentDocumentId).toBe('p-1')
  })

  it('resolveDocumentPath 沿父链解析完整路径（含集合名）', async () => {
    const docs = new Map<string, any>([
      ['leaf', { id: 'leaf', title: '叶子', url: '/doc/leaf', text: '', updatedAt: '', collectionId: 'col-1', parentDocumentId: 'mid' }],
      ['mid', { id: 'mid', title: '中层', url: '/doc/mid', text: '', updatedAt: '', collectionId: 'col-1', parentDocumentId: 'root' }],
      ['root', { id: 'root', title: '根目录', url: '/doc/root', text: '', updatedAt: '', collectionId: 'col-1' }],
    ])
    const client = new OutlineClient({
      baseUrl: 'https://outline.example.com',
      apiToken: 'tok',
      fetchImpl: stubFetch(async (url, init) => {
        if (String(url).includes('/api/collections.list')) {
          return { status: 200, body: { data: [{ id: 'col-1', name: '运维集合', permission: 'read_write' }] } }
        }
        const body = JSON.parse(String(init.body)) as { id?: string }
        const doc = docs.get(body.id ?? '')
        return doc === undefined
          ? { status: 404, body: {} }
          : { status: 200, body: { data: doc } }
      }),
    })
    const path = await client.resolveDocumentPath('leaf')
    expect(path).toEqual(['运维集合', '根目录', '中层', '叶子'])
  })
})