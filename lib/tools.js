import { defineTool } from '@deepseek-ai/dsh-tools';
export const SEARCH_MAX_LIMIT = 25;
export const DOCUMENT_DEFAULT_MAX_LENGTH = 20000;
export const DOCUMENT_MAX_LENGTH_CAP = 200000;
/** 转义链接文字里的 Markdown 特殊字符，避免标题含 []() 时破坏 [title](url) 链接。 */
function escapeLinkText(text) {
    return text.replace(/[\\[\]]/g, (ch) => (ch === '\\' ? '\\\\' : '\\' + ch));
}
/** URL 含空格或括号时用 <> 包裹，保证 markdown 链接闭合正确。 */
function wrapUrl(url) {
    return /[\s()]/.test(url) ? `<${url}>` : url;
}
function renderSearchResults(result) {
    const { total, hits } = result;
    if (hits.length === 0) {
        return total > 0 ? `该关键词共匹配 ${total} 篇文档，但未返回可展示的结果。` : '未找到匹配文档，可尝试更换关键词。';
    }
    const head = `找到 ${hits.length} 篇文档${total > hits.length ? `（关键词共匹配 ${total} 篇，显示前 ${hits.length} 篇）` : ''}：`;
    const lines = hits.map((hit) => {
        const meta = hit.snippet.length > 0 ? ` — ${hit.snippet}` : '';
        return `- [${escapeLinkText(hit.title)}](${wrapUrl(hit.url)})${meta}（id: ${hit.id}）`;
    });
    return `${head}\n${lines.join('\n')}\n\n如需查看某篇全文，请使用 outline_get_document 工具（参数 id）。`;
}
function renderDocument(doc, truncated) {
    const note = truncated ? '\n\n…（内容过长已截断，可增大 maxLength 参数）' : '';
    return `# ${doc.title}\n\n${doc.url}\n\n${doc.text}${note}`;
}
export function outlineSearchTool(makeClient, defaultLimit) {
    return defineTool({
        name: 'outline_search',
        description: '在 Outline 知识库中按关键词搜索文档，返回该关键词的匹配总数、标题、命中片段、文档 id 与链接。配置好 token 后即可检索全部文档。',
        parameters: {
            query: { type: 'string', required: true, description: '搜索关键词' },
            limit: { type: 'integer', description: `返回结果条数（默认 ${defaultLimit}，最大 ${SEARCH_MAX_LIMIT}）` },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    total: { type: 'integer', required: true, description: '该关键词在知识库中的匹配总数' },
                    hits: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                id: { type: 'string', required: true },
                                title: { type: 'string', required: true },
                                url: { type: 'string', required: true },
                                snippet: { type: 'string', required: true },
                                collectionId: { type: 'string', required: true },
                                updatedAt: { type: 'string', required: true },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => [{ type: 'text', text: renderSearchResults(value) }],
        },
        async execute(args) {
            const limit = Math.min(SEARCH_MAX_LIMIT, Math.max(1, args.limit ?? defaultLimit));
            const client = makeClient();
            return client.searchDocuments(args.query, limit);
        },
    });
}
export function outlineCountTool(makeClient) {
    return defineTool({
        name: 'outline_count',
        description: '统计 Outline 知识库文档总数（documents.list 分页 total，精确值；不含已删除/回收站文档，若计入则实际总数可能略多）。用于回答"知识库有多少文档 / 多大"等问题；若要检索具体文档请用 outline_search。',
        parameters: {},
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    total: { type: 'integer', required: true, description: 'Outline 知识库文档总数（不含已删除/回收站文档）' },
                },
            },
            render: (_args, value) => [{ type: 'text', text: `Outline 知识库当前可访问文档总数：${value.total} 篇。` }],
        },
        async execute() {
            return { total: await makeClient().countDocuments() };
        },
    });
}
export function outlineGetDocumentTool(makeClient) {
    return defineTool({
        name: 'outline_get_document',
        description: '按文档 id（来自 outline_search 的结果或 Outline 的 urlId）获取文档完整内容（Markdown 格式）。',
        parameters: {
            id: { type: 'string', required: true, description: '文档 UUID 或 urlId' },
            maxLength: { type: 'integer', description: '返回内容最大字符数（默认 20000，最小 1000，最大 200000），超出截断' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    id: { type: 'string', required: true },
                    title: { type: 'string', required: true },
                    url: { type: 'string', required: true },
                    text: { type: 'string', required: true },
                    truncated: { type: 'boolean', required: true },
                    updatedAt: { type: 'string', required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: renderDocument(value, value.truncated) }],
        },
        async execute(args) {
            const maxLength = Math.min(DOCUMENT_MAX_LENGTH_CAP, Math.max(1000, args.maxLength ?? DOCUMENT_DEFAULT_MAX_LENGTH));
            const doc = await makeClient().getDocument(args.id);
            const truncated = doc.text.length > maxLength;
            return { ...doc, text: truncated ? doc.text.slice(0, maxLength) : doc.text, truncated };
        },
    });
}
/** 审批提示文案：集合名 + 标题 + 内容预览（前 100 字，纯函数可单测）。 */
export function buildCreateApprovalReason(args, collectionName) {
    const name = collectionName && collectionName !== '' ? collectionName : (args.collectionId ?? '未知集合');
    const preview = (args.text ?? '').replace(/\s+/g, ' ').slice(0, 100);
    return `创建 Outline 文档：集合「${name}」/ 标题「${args.title ?? '(无标题)'}」\n内容预览：${preview}${(args.text ?? '').length > 100 ? '…' : ''}`;
}
/** 禁止写入的集合名（精确匹配，去除首尾空白）。命中即拒绝 outline_create，即使审批也不会放行。 */
export const FORBIDDEN_WRITE_COLLECTIONS = ['内部集合'];
/**
 * 写入守卫：按集合名判断是否允许创建文档。
 * @returns 禁止时返回错误提示文案；允许时返回 null。
 */
export function resolveWriteGuard(collections, collectionId) {
    const name = (collections.find((c) => c.id === collectionId)?.name ?? '').trim();
    if (name !== '' && FORBIDDEN_WRITE_COLLECTIONS.includes(name)) {
        return `禁止在集合「${name}」创建文档（该集合受保护，不允许写入）。`;
    }
    return null;
}
export function outlineListCollectionsTool(makeClient) {
    return defineTool({
        name: 'outline_list_collections',
        description: '列出当前 token 可见的 Outline 集合（id、名称、权限、文档数），用于确定 outline_create 的目标集合。',
        parameters: {},
        output: {
            schema: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string', required: true },
                        name: { type: 'string', required: true },
                        permission: { type: 'string', required: true },
                        documentCount: { type: 'integer', description: '文档数（部分实例可能不返回）' },
                    },
                },
            },
            render: (_args, value) => [{
                    type: 'text',
                    text: value.length === 0
                        ? '当前 token 没有可见集合。'
                        : `可见集合（${value.length} 个）：\n` + value.map((c) => `- ${c.name}（${c.id}，${c.permission}${typeof c.documentCount === 'number' ? `，文档 ${c.documentCount} 篇` : ''}）`).join('\n'),
                }],
        },
        async execute() {
            return makeClient().listCollections();
        },
    });
}
export function outlineCreateTool(makeClient) {
    return defineTool({
        name: 'outline_create',
        description: '在指定 Outline 集合创建文档（写操作，每次执行前需用户审批）。创建后返回文档链接。请先用 outline_list_collections 确认目标集合 id。',
        parameters: {
            collectionId: { type: 'string', required: true, description: '目标集合 id（用 outline_list_collections 获取）' },
            title: { type: 'string', required: true, description: '文档标题' },
            text: { type: 'string', required: true, description: 'Markdown 正文' },
            publish: { type: 'boolean', description: '默认 true（创建即发布）；false = 存草稿（仅作者可见）' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    id: { type: 'string', required: true },
                    url: { type: 'string', required: true },
                    title: { type: 'string', required: true },
                    published: { type: 'boolean', required: true },
                },
            },
            render: (_args, value) => [{
                    type: 'text',
                    text: value.published
                        ? `✅ 已创建并发布文档：${escapeLinkText(value.title)} → ${wrapUrl(value.url)}`
                        : `📝 已创建草稿（未发布）：${escapeLinkText(value.title)} → ${wrapUrl(value.url)}`,
                }],
        },
        async execute(args) {
            const client = makeClient();
            // 写入守卫：受保护集合一律拒绝（防御纵深，即使绕过审批直调也会被拦）
            const guard = resolveWriteGuard(await client.listCollections(), args.collectionId);
            if (guard !== null)
                throw new Error(guard);
            return client.createDocument({
                collectionId: args.collectionId,
                title: args.title,
                text: args.text,
                publish: args.publish,
            });
        },
    });
}
