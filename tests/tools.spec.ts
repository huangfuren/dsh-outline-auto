import { describe, it, expect } from 'vitest'
import { outlineSearchTool, outlineGetDocumentTool, outlineCountTool, outlineListCollectionsTool, outlineResolvePathTool, outlineCreateTool, outlineUpdateDocumentTool, outlineDeleteTool, outlineListChildrenTool, outlineDocTemplateTool, buildCreateApprovalReason, resolveWriteGuard } from '../src/tools.js'
import { OutlineApiError } from '../src/errors.js'
import type { OutlineClient } from '../src/client.js'

function fakeClient(overrides: Partial<OutlineClient> = {}): OutlineClient {
  return {
    searchDocuments: async (query: string) => ({ total: 1, hits: [{ id: 'doc-1', title: query, url: '/d', snippet: 's', collectionId: '', updatedAt: '' }] }),
    getDocument: async (id: string) => ({ id, title: 'T', url: '/d', text: 'body', updatedAt: '' }),
    countDocuments: async () => 42,
    ...overrides,
  } as unknown as OutlineClient
}

const exec = {} as never

describe('outline_search', () => {
  it('execute 返回 {total, hits} 归一化结果', async () => {
    const tool = outlineSearchTool(() => fakeClient(), 10)
    const result = await tool.execute({ query: '部署' }, exec) as any
    expect(result.total).toBe(1)
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].id).toBe('doc-1')
  })

  it('limit 超界被钳制', async () => {
    let seen = 0
    const tool = outlineSearchTool(() => fakeClient({ searchDocuments: async (_q, limit) => { seen = limit; return { total: 0, hits: [] } } }), 10)
    await tool.execute({ query: 'x', limit: 999 }, exec)
    expect(seen).toBe(25)
  })

  it('未配置时抛出中文配置错误', async () => {
    const tool = outlineSearchTool(() => { throw new Error('dsh-outline-auto 未配置：…') }, 10)
    await expect(tool.execute({ query: 'x' }, exec)).rejects.toThrow('未配置')
  })

  it('渲染结果时标题特殊字符被转义、含括号 URL 被 <> 包裹', async () => {
    const tool = outlineSearchTool(() => fakeClient(), 10)
    const value = {
      total: 1,
      hits: [{
        id: 'doc-1',
        title: '部署[规范]（测试版）',
        url: 'https://outline.example.com/doc/a(b)',
        snippet: '片段',
        collectionId: 'c',
        updatedAt: '',
      }],
    }
    const rendered = (tool as any).output.render({}, value)
    const text = Array.isArray(rendered) ? rendered.map((r: any) => r.text).join('\n') : String(rendered)
    expect(text).toContain('[部署\\[规范\\]（测试版）](<https://outline.example.com/doc/a(b)>)')
  })
})

describe('outline_count', () => {
  it('execute 返回文档总数', async () => {
    const tool = outlineCountTool(() => fakeClient())
    const result = await tool.execute({} as never, exec) as any
    expect(result.total).toBe(42)
  })
})

describe('outline_list_collections', () => {
  it('execute 返回集合列表', async () => {
    const tool = outlineListCollectionsTool(() => fakeClient({ listCollections: async () => [{ id: 'col-1', name: '测试集合', permission: 'read_write', documentCount: 42 }] }))
    const result = await tool.execute({} as never, exec) as any
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('col-1')
  })
})

describe('outline_create', () => {
  it('execute 传入参数并返回结果', async () => {
    let seen: any
    const tool = outlineCreateTool(() => fakeClient({
      listCollections: async () => [{ id: 'col-1', name: '测试集合', permission: 'read_write' }],
      createDocument: async (input) => { seen = input; return { id: 'd1', url: 'https://outline.example.com/doc/d1', title: input.title, published: true } },
    }), () => ['内部集合'])
    const result = await tool.execute({ collectionId: 'col-1', title: 'T', text: 'B', parentDocumentId: 'parent-1' }, exec) as any
    expect(seen).toEqual({ collectionId: 'col-1', parentDocumentId: 'parent-1', title: 'T', text: 'B', publish: undefined })
    expect(result.url).toContain('doc/d1')
  })

  it('execute 拒绝向受保护集合写入', async () => {
    const tool = outlineCreateTool(() => fakeClient({ listCollections: async () => [{ id: 'ops', name: '内部集合', permission: 'read_write' }] }), () => ['内部集合'])
    await expect(tool.execute({ collectionId: 'ops', title: 'T', text: 'B' }, exec)).rejects.toThrow('禁止')
  })
})

describe('resolveWriteGuard', () => {
  it('禁止在受保护集合写入', () => {
    const err = resolveWriteGuard([{ id: 'c1', name: '内部集合', permission: 'read_write' }], 'c1', ['内部集合'])
    expect(err).toContain('禁止')
  })
  it('普通集合放行', () => {
    expect(resolveWriteGuard([{ id: 'c2', name: '测试集合', permission: 'read_write' }], 'c2', ['内部集合'])).toBeNull()
  })
  it('集合名未知时放行（id 兜底）', () => {
    expect(resolveWriteGuard([], 'c9', ['内部集合'])).toBeNull()
  })
})

describe('outline_resolve_path', () => {
  it('解析 集合/目录1/目录2 路径', async () => {
    const tool = outlineResolvePathTool(() => fakeClient({
      listCollections: async () => [{ id: 'col-1', name: '运维集合', permission: 'read_write' }],
      searchDocuments: async (q: string, _l: number, collectionId?: string) => {
        if (q === '个人笔记') return { total: 1, hits: [{ id: 'root-1', title: '《个人笔记》', url: '/d', snippet: '', collectionId: collectionId ?? 'col-1', updatedAt: '' }] }
        return { total: 0, hits: [] }
      },
      listChildDocuments: async (parentId: string) => parentId === 'root-1'
        ? [{ id: 'leaf-1', title: '随手记-黄继晨', url: '/d', snippet: '', collectionId: 'col-1', updatedAt: '', parentDocumentId: 'root-1' }]
        : [],
    }))
    const result = await tool.execute({ path: '运维集合/个人笔记/随手记黄继晨' }, exec) as any
    expect(result).toMatchObject({ collectionId: 'col-1', parentDocumentId: 'leaf-1', path: ['运维集合', '《个人笔记》', '随手记-黄继晨'] })
  })

  it('集合不存在时报错并列出候选', async () => {
    const tool = outlineResolvePathTool(() => fakeClient({ listCollections: async () => [{ id: 'col-1', name: '运维集合', permission: 'read_write' }] }))
    await expect(tool.execute({ path: '不存在的集合/x' }, exec)).rejects.toThrow('找不到集合')
  })

  it('子目录找不到时报错', async () => {
    const tool = outlineResolvePathTool(() => fakeClient({
      listCollections: async () => [{ id: 'col-1', name: '运维集合', permission: 'read_write' }],
      searchDocuments: async () => ({ total: 0, hits: [] }),
    }))
    await expect(tool.execute({ path: '运维集合/不存在的目录' }, exec)).rejects.toThrow('找不到')
  })
})

describe('outline_search 过滤', () => {
  it('透传 collectionId/userId/updatedAfter', async () => {
    let seen: any
    const tool = outlineSearchTool(() => fakeClient({ searchDocuments: async (q, l, coll, filters) => { seen = { q, l, coll, filters }; return { total: 0, hits: [] } } }), 10)
    await tool.execute({ query: 'x', collectionId: 'c1', userId: 'u1', updatedAfter: '2026-08-01' }, exec)
    expect(seen).toEqual({ q: 'x', l: 10, coll: 'c1', filters: { userId: 'u1', updatedAfter: '2026-08-01' } })
  })
})

describe('outline_update_document', () => {
  it('更新标题并传参', async () => {
    let seen: any
    const tool = outlineUpdateDocumentTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: '旧', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-1' }),
      listCollections: async () => [{ id: 'col-1', name: '测试集合', permission: 'read_write' }],
      updateDocument: async (id, input) => { seen = { id, ...input }; return { id, url: '/doc/d1', title: input.title ?? '旧', published: true } },
    }), () => ['内部集合'])
    const r = await tool.execute({ id: 'd1', title: '新标题' }, exec) as any
    expect(seen).toEqual({ id: 'd1', title: '新标题' })
    expect(r.title).toBe('新标题')
  })
  it('受保护集合拒绝更新', async () => {
    const tool = outlineUpdateDocumentTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: 'T', url: '/d', text: 'x', updatedAt: '', collectionId: 'ops' }),
      listCollections: async () => [{ id: 'ops', name: '内部集合', permission: 'read_write' }],
    }), () => ['内部集合'])
    await expect(tool.execute({ id: 'd1', text: 'x' }, exec)).rejects.toThrow('禁止')
  })
  it('至少需要 title 或 text', async () => {
    const tool = outlineUpdateDocumentTool(() => fakeClient(), () => ['内部集合'])
    await expect(tool.execute({ id: 'd1' }, exec)).rejects.toThrow('至少需要')
  })
})

describe('outline_delete', () => {
  it('第二道审批通过后删除', async () => {
    let asked = ''
    const tool = outlineDeleteTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: 'T', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-1' }),
      listCollections: async () => [{ id: 'col-1', name: '测试集合', permission: 'read_write' }],
      resolveDocumentPath: async () => ['测试集合', 'T'],
      deleteDocument: async () => ({ success: true }),
    }), () => ['内部集合'], async (reason, _exec) => { asked = reason; return true })
    const r = await tool.execute({ id: 'd1' }, exec) as any
    expect(asked).toContain('再次确认')
    expect(r.success).toBe(true)
  })
  it('第二道审批拒绝则取消删除', async () => {
    const tool = outlineDeleteTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: 'T', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-1' }),
      listCollections: async () => [{ id: 'col-1', name: '测试集合', permission: 'read_write' }],
      resolveDocumentPath: async () => ['测试集合', 'T'],
    }), () => ['内部集合'], async () => false)
    await expect(tool.execute({ id: 'd1' }, exec)).rejects.toThrow('取消')
  })
})

describe('outline_doc_template', () => {
  it('返回需求文档模板且包含全部章节', async () => {
    const tool = outlineDocTemplateTool()
    const r = await tool.execute({} as never, exec) as any
    for (const s of ['【目标】', '【交付物】', '【交付标准】', '【交付时间】', '【工作思路】', '【潜在风险点】', '当前状态']) {
      expect(r.template).toContain(s)
    }
    expect(r.sections).toContain('目标')
    expect(r.sections).toContain('潜在风险点')
  })
})

describe('输出 schema 完整性（回归：parentDocumentId 等字段必须声明，避免被 additionalProperties:false 剥离）', () => {
  it('search/get_document/list_children schema 声明 parentDocumentId/collectionId', () => {
    const search = (outlineSearchTool(() => fakeClient(), 10) as any).output.schema
    expect(search.properties.hits.items.properties.parentDocumentId).toBeDefined()
    const get = (outlineGetDocumentTool(() => fakeClient()) as any).output.schema
    expect(get.properties.collectionId).toBeDefined()
    expect(get.properties.parentDocumentId).toBeDefined()
    const children = (outlineListChildrenTool(() => fakeClient()) as any).output.schema
    expect(children.items.properties.parentDocumentId).toBeDefined()
    expect(children.items.properties.snippet).toBeDefined()
  })
})

describe('outline_list_children', () => {
  it('返回子文档', async () => {
    const tool = outlineListChildrenTool(() => fakeClient({ listChildDocuments: async () => [{ id: 'c1', title: '子', url: '/d', snippet: '', collectionId: 'col-1', updatedAt: '' }] }))
    const r = await tool.execute({ parentId: 'p' }, exec) as any
    expect(r).toHaveLength(1)
    expect(r[0].title).toBe('子')
  })
})

describe('buildCreateApprovalReason', () => {
  it('包含集合名、标题与内容预览', () => {
    const reason = buildCreateApprovalReason({ collectionId: 'col-1', title: '测试文档', text: '第一行内容，用于预览。' + '长'.repeat(200) }, '运维集合')
    expect(reason).toContain('运维集合')
    expect(reason).toContain('测试文档')
    expect(reason).toContain('…')
    expect(reason.length).toBeLessThan(300)
  })
  it('集合名缺失时回退 collectionId', () => {
    expect(buildCreateApprovalReason({ collectionId: 'col-9', title: 'T' })).toContain('col-9')
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