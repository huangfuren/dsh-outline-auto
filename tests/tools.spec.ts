import { describe, it, expect } from 'vitest'
import {
  outlineSearchTool, outlineGetDocumentTool, outlineCountTool, outlineListCollectionsTool, outlineResolvePathTool,
  outlineCreateTool, outlineUpdateDocumentTool, outlineDeleteTool, outlineListChildrenTool, outlineDocTemplateTool,
  buildCreateApprovalReason, resolveWriteGuard, resolvePathGuard, parseWritablePaths,
} from '../src/tools.js'
import { OutlineApiError } from '../src/errors.js'
import type { OutlineClient } from '../src/client.js'

function fakeClient(overrides: Partial<OutlineClient> = {}): OutlineClient {
  return {
    searchDocuments: async (query: string) => ({ total: 1, hits: [{ id: 'doc-1', title: query, url: '/d', snippet: 's', collectionId: '', updatedAt: '' }] }),
    getDocument: async (id: string) => ({ id, title: 'T', url: '/d', text: 'body', updatedAt: '' }),
    countDocuments: async () => 42,
    resolveDocumentPath: async (docId: string) => [docId],
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
  it('execute 传入参数并返回结果（目标在白名单内）', async () => {
    let seen: any
    const tool = outlineCreateTool(() => fakeClient({
      listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }],
      resolveDocumentPath: async () => ['集合A', '父目录'],
      createDocument: async (input) => { seen = input; return { id: 'd1', url: 'https://outline.example.com/doc/d1', title: input.title, published: true } },
    }), () => '集合A')
    const result = await tool.execute({ collectionId: 'col-1', title: 'T', text: 'B', parentDocumentId: 'parent-1' }, exec) as any
    expect(seen).toEqual({ collectionId: 'col-1', parentDocumentId: 'parent-1', title: 'T', text: 'B', publish: undefined })
    expect(result.url).toContain('doc/d1')
  })

  it('未配置白名单时拒绝（只读模式，连审批都不弹）', async () => {
    const tool = outlineCreateTool(() => fakeClient({ listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }] }), () => '')
    await expect(tool.execute({ collectionId: 'col-1', title: 'T', text: 'B' }, exec)).rejects.toThrow('只读模式')
  })

  it('目标集合不存在时拒绝（失败关闭）', async () => {
    const tool = outlineCreateTool(() => fakeClient({ listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }] }), () => '集合A')
    await expect(tool.execute({ collectionId: 'col-9', title: 'T', text: 'B' }, exec)).rejects.toThrow('无法确认写入目标集合')
  })

  it('目标在白名单外时拒绝', async () => {
    const tool = outlineCreateTool(() => fakeClient({ listCollections: async () => [{ id: 'col-2', name: '其它集合', permission: 'read_write' }] }), () => '集合A')
    await expect(tool.execute({ collectionId: 'col-2', title: 'T', text: 'B' }, exec)).rejects.toThrow('不在可写目录内')
  })
})

describe('parseWritablePaths', () => {
  it('空串解析为空列表', () => {
    expect(parseWritablePaths('')).toEqual([])
    expect(parseWritablePaths('  ,,  ')).toEqual([])
  })
  it('解析集合级条目', () => {
    expect(parseWritablePaths(' 集合A ')).toEqual([{ collectionName: '集合A', segments: [] }])
  })
  it('解析目录级条目（逗号分隔）', () => {
    expect(parseWritablePaths('集合A,集合B/目录1/子目录2')).toEqual([
      { collectionName: '集合A', segments: [] },
      { collectionName: '集合B', segments: ['目录1', '子目录2'] },
    ])
  })
  it('过滤空白段', () => {
    expect(parseWritablePaths('集合A/目录1,,集合B/ /目录2')).toEqual([
      { collectionName: '集合A', segments: ['目录1'] },
      { collectionName: '集合B', segments: ['目录2'] },
    ])
  })
})

describe('resolvePathGuard', () => {
  const collections = [
    { id: 'col-1', name: '集合A', permission: 'read_write' },
    { id: 'col-2', name: '集合B', permission: 'read_write' },
  ]

  it('白名单为空 → 只读模式拒绝', async () => {
    const err = await resolvePathGuard(fakeClient(), { kind: 'create', collectionId: 'col-1' }, [], collections)
    expect(err).toContain('只读模式')
  })

  it('集合级白名单放行集合根级创建', async () => {
    const err = await resolvePathGuard(fakeClient(), { kind: 'create', collectionId: 'col-1' }, parseWritablePaths('集合A'), collections)
    expect(err).toBeNull()
  })

  it('集合级白名单放行目录内任意层级（create 父目录）', async () => {
    const client = fakeClient({ resolveDocumentPath: async () => ['集合A', '目录1', '子目录'] })
    const err = await resolvePathGuard(client, { kind: 'create', collectionId: 'col-1', parentDocumentId: 'p' }, parseWritablePaths('集合A'), collections)
    expect(err).toBeNull()
  })

  it('目录级白名单前缀匹配（doc 目标含全部子级）', async () => {
    const client = fakeClient({ resolveDocumentPath: async () => ['集合A', '目录1', '子目录', '文档X'] })
    const err = await resolvePathGuard(client, { kind: 'doc', docId: 'd' }, parseWritablePaths('集合A/目录1'), collections)
    expect(err).toBeNull()
  })

  it('目录级白名单不匹配兄弟目录', async () => {
    const client = fakeClient({ resolveDocumentPath: async () => ['集合A', '目录2', '文档X'] })
    const err = await resolvePathGuard(client, { kind: 'doc', docId: 'd' }, parseWritablePaths('集合A/目录1'), collections)
    expect(err).toContain('不在可写目录内')
  })

  it('集合不匹配时拒绝', async () => {
    const client = fakeClient({ resolveDocumentPath: async () => ['集合B', '文档X'] })
    const err = await resolvePathGuard(client, { kind: 'doc', docId: 'd' }, parseWritablePaths('集合A'), collections)
    expect(err).toContain('不在可写目录内')
  })

  it('create 目标集合不存在 → 拒绝（失败关闭）', async () => {
    const err = await resolvePathGuard(fakeClient(), { kind: 'create', collectionId: 'col-9' }, parseWritablePaths('集合A'), collections)
    expect(err).toContain('无法确认写入目标集合')
  })

  it('目标路径解析失败 → 拒绝', async () => {
    const client = fakeClient({ resolveDocumentPath: async () => { throw new Error('boom') } })
    const err = await resolvePathGuard(client, { kind: 'doc', docId: 'd' }, parseWritablePaths('集合A'), collections)
    expect(err).toContain('无法解析写入目标路径')
  })
})

describe('resolveWriteGuard', () => {
  it('普通集合放行', () => {
    expect(resolveWriteGuard([{ id: 'c2', name: '测试集合', permission: 'read_write' }], 'c2')).toBeNull()
  })
  it('集合不可确认时拒绝写入（失败关闭）', () => {
    expect(resolveWriteGuard([], 'c9')).toContain('无法确认')
  })
  it('只读权限集合拒绝写入', () => {
    expect(resolveWriteGuard([{ id: 'c3', name: '只读集合', permission: 'read_only' }], 'c3')).toContain('禁止')
  })
})

describe('outline_resolve_path', () => {
  it('解析 集合/目录1/目录2 路径', async () => {
    const tool = outlineResolvePathTool(() => fakeClient({
      listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }],
      searchDocuments: async (q: string, _l: number, collectionId?: string) => {
        if (q === '目录1') return { total: 1, hits: [{ id: 'root-1', title: '目录1', url: '/d', snippet: '', collectionId: collectionId ?? 'col-1', updatedAt: '' }] }
        return { total: 0, hits: [] }
      },
      listChildDocuments: async (parentId: string) => parentId === 'root-1'
        ? [{ id: 'leaf-1', title: '子目录-2', url: '/d', snippet: '', collectionId: 'col-1', updatedAt: '', parentDocumentId: 'root-1' }]
        : [],
    }))
    const result = await tool.execute({ path: '集合A/目录1/子目录2' }, exec) as any
    expect(result).toMatchObject({ collectionId: 'col-1', parentDocumentId: 'leaf-1', path: ['集合A', '目录1', '子目录-2'] })
  })

  it('集合不存在时报错并列出候选', async () => {
    const tool = outlineResolvePathTool(() => fakeClient({ listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }] }))
    await expect(tool.execute({ path: '不存在的集合/x' }, exec)).rejects.toThrow('找不到集合')
  })

  it('子目录找不到时报错', async () => {
    const tool = outlineResolvePathTool(() => fakeClient({
      listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }],
      searchDocuments: async () => ({ total: 0, hits: [] }),
    }))
    await expect(tool.execute({ path: '集合A/不存在的目录' }, exec)).rejects.toThrow('找不到')
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
  it('更新标题并传参（目标在白名单内）', async () => {
    let seen: any
    const tool = outlineUpdateDocumentTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: '旧', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-1' }),
      listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }],
      resolveDocumentPath: async () => ['集合A', '旧文档'],
      updateDocument: async (id, input) => { seen = { id, ...input }; return { id, url: '/doc/d1', title: input.title ?? '旧', published: true } },
    }), () => '集合A')
    const r = await tool.execute({ id: 'd1', title: '新标题' }, exec) as any
    expect(seen).toEqual({ id: 'd1', title: '新标题' })
    expect(r.title).toBe('新标题')
  })
  it('未配置白名单时拒绝更新（只读模式）', async () => {
    const tool = outlineUpdateDocumentTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: 'T', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-1' }),
      listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }],
      resolveDocumentPath: async () => ['集合A', 'T'],
    }), () => '')
    await expect(tool.execute({ id: 'd1', text: 'x' }, exec)).rejects.toThrow('只读模式')
  })
  it('目标在白名单外时拒绝更新', async () => {
    const tool = outlineUpdateDocumentTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: 'T', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-2' }),
      listCollections: async () => [{ id: 'col-2', name: '其它集合', permission: 'read_write' }],
      resolveDocumentPath: async () => ['其它集合', 'T'],
    }), () => '集合A')
    await expect(tool.execute({ id: 'd1', text: 'x' }, exec)).rejects.toThrow('不在可写目录内')
  })
  it('至少需要 title 或 text', async () => {
    const tool = outlineUpdateDocumentTool(() => fakeClient(), () => '集合A')
    await expect(tool.execute({ id: 'd1' }, exec)).rejects.toThrow('至少需要')
  })
})

describe('outline_delete', () => {
  it('第二道审批通过后删除', async () => {
    let asked = ''
    const tool = outlineDeleteTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: 'T', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-1' }),
      listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }],
      resolveDocumentPath: async () => ['集合A', 'T'],
      deleteDocument: async () => ({ success: true }),
    }), () => '集合A', async (reason, _exec) => { asked = reason; return true })
    const r = await tool.execute({ id: 'd1' }, exec) as any
    expect(asked).toContain('再次确认')
    expect(r.success).toBe(true)
  })
  it('第二道审批拒绝则取消删除', async () => {
    const tool = outlineDeleteTool(() => fakeClient({
      getDocument: async () => ({ id: 'd1', title: 'T', url: '/d', text: 'x', updatedAt: '', collectionId: 'col-1' }),
      listCollections: async () => [{ id: 'col-1', name: '集合A', permission: 'read_write' }],
      resolveDocumentPath: async () => ['集合A', 'T'],
    }), () => '集合A', async () => false)
    await expect(tool.execute({ id: 'd1' }, exec)).rejects.toThrow('取消')
  })
})

describe('outline_doc_template', () => {
  it('返回需求文档模板且包含全部章节', async () => {
    const tool = outlineDocTemplateTool()
    const r = await tool.execute({} as never, exec) as any
    for (const s of ['【需求或目标】', '【交付物】', '【交付标准】', '【交付时间】', '【潜在风险点】', '【解决的问题】', '【工作思路】', '【备注】', '当前状态']) {
      expect(r.template).toContain(s)
    }
    expect(r.sections).toContain('需求或目标')
    expect(r.sections).toContain('潜在风险点')
    expect(r.sections).toContain('备注')
  })

  it('条目类章节示范一点一行、逐条编号的排版（防挤成一段）', async () => {
    const tool = outlineDocTemplateTool()
    const r = await tool.execute({} as never, exec) as any
    // 【交付物】 下必须出现逐条编号的行（1、<交付物 1> 换行 2、…）
    expect(r.template).toMatch(/【交付物】[^\n]*\n1、<交付物 1>\n2、<交付物 2>\n3、<交付物 3>/)
    expect(r.template).toMatch(/【工作思路】[^\n]*\n1\. <第一步>\n2\. <第二步>\n3\. <第三步>/)
    expect(r.template).toMatch(/【潜在风险点】[^\n]*\n1、<风险 1>\n2、<风险 2>/)
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
    const reason = buildCreateApprovalReason({ collectionId: 'col-1', title: '测试文档', text: '第一行内容，用于预览。' + '长'.repeat(200) }, '集合A')
    expect(reason).toContain('集合A')
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
