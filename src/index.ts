import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
// 类型增强：ctx.approval（ApprovalService）挂在 Context 上
import type {} from '@deepseek-ai/dsh-user-approval'
import { Config } from './config.js'
import { OutlineClient } from './client.js'
import {
  outlineSearchTool, outlineGetDocumentTool, outlineCountTool, outlineListCollectionsTool,
  outlineResolvePathTool, outlineCreateTool, outlineUpdateDocumentTool, outlineDeleteTool,
  outlineListChildrenTool, buildCreateApprovalReason, resolveWriteGuard, FORBIDDEN_WRITE_COLLECTIONS,
} from './tools.js'
import type { OutlineCollection } from './client.js'

export const name = 'dsh-outline-auto'
export const inject = ['tools']

/** GUI 设置命名空间（设置 → 插件 → 插件配置 的卡片读写它，持久化在 settings.yaml）。 */
const SETTINGS_NS = settingsNamespace('outline-auto')

export function apply(ctx: Context, config: Config = {} as Config) {
  // 连接配置优先级（与 README 一致）：GUI 卡片（settings.yaml 用户层）→ 环境变量 → 插件配置行。
  // settings 注册时 base 传空对象，使解析值只反映 GUI 用户层，环境变量与配置行在下方回退。
  let settingsSource: () => Config = () => ({} as Config)

  const makeClient = () => {
    const s = settingsSource()
    const baseUrl = (s.baseUrl ?? '').trim()
      || (process.env.OUTLINE_BASE_URL ?? '').trim()
      || (config.baseUrl ?? '').trim()
    const apiToken = (s.apiToken ?? '').trim()
      || (process.env.OUTLINE_API_TOKEN ?? '').trim()
      || (config.apiToken ?? '').trim()
    if (!baseUrl || !apiToken) {
      throw new Error(
        'dsh-outline-auto 未配置：需要 baseUrl 与 apiToken（可在 设置 → 插件 → 插件配置 填写，或环境变量 OUTLINE_BASE_URL / OUTLINE_API_TOKEN）。配置方法见插件 README。',
      )
    }
    return new OutlineClient({ baseUrl, apiToken, timeoutMs: config.timeoutMs ?? 15000 })
  }

  // 受保护集合：settings 用户层 → 插件配置 → 默认 ['内部集合']
  const getProtected = (): string[] => {
    const s = settingsSource()
    const raw = (s.protectedCollections ?? config.protectedCollections ?? FORBIDDEN_WRITE_COLLECTIONS.join(','))
    return raw.split(',').map((x) => x.trim()).filter((x) => x !== '')
  }

  installSettingsSection(ctx, SETTINGS_NS, Config, {} as Config, {
    setSource: (current) => {
      settingsSource = current
    },
    onChange: () => {},
  })

  ctx.tools.register(outlineSearchTool(makeClient, config.searchLimit ?? 10))
  ctx.tools.register(outlineGetDocumentTool(makeClient))
  ctx.tools.register(outlineCountTool(makeClient))
  ctx.tools.register(outlineListCollectionsTool(makeClient))
  ctx.tools.register(outlineResolvePathTool(makeClient))
  ctx.tools.register(outlineListChildrenTool(makeClient))
  ctx.tools.register(outlineCreateTool(makeClient, getProtected))
  ctx.tools.register(outlineUpdateDocumentTool(makeClient, getProtected))
  ctx.tools.register(outlineDeleteTool(makeClient, getProtected, async (reason, exec) => {
    const outcome = await ctx.approval.request({
      agent: exec.agent as never,
      toolName: 'outline_delete',
      callId: exec.callId as never,
      reason,
    })
    return outcome === 'allowed-once'
  }))

  // 写工具审批闸：create/update/delete 需用户确认；受保护集合直接拒绝（连审批都不弹）。
  ctx.on('tools/pre-execute', async (exec, next) => {
    const name = exec.name
    const args = (exec.arguments ?? {}) as Record<string, string | undefined>

    if (name === 'outline_create') {
      const a = args as { collectionId?: string; title?: string; text?: string; parentDocumentId?: string }
      let collectionName: string | undefined
      let resolvedPath: string[] | undefined
      let collections: OutlineCollection[] = []
      try {
        collections = await makeClient().listCollections()
        collectionName = collections.find((c) => c.id === a.collectionId)?.name
      } catch {
        collectionName = undefined
      }
      if (a.parentDocumentId !== undefined && a.parentDocumentId !== '') {
        try {
          resolvedPath = await makeClient().resolveDocumentPath(a.parentDocumentId)
        } catch {
          resolvedPath = undefined
        }
      }
      const guard = resolveWriteGuard(collections, a.collectionId ?? '', getProtected())
      if (guard !== null) return { kind: 'deny', reason: guard }
      return { kind: 'ask', reason: buildCreateApprovalReason(a, collectionName, resolvedPath) }
    }

    if (name === 'outline_update_document' || name === 'outline_delete') {
      const id = args.id ?? ''
      if (id === '') return next()
      let docPath: string[] | undefined
      let collectionId: string | undefined
      try {
        const client = makeClient()
        docPath = await client.resolveDocumentPath(id)
        collectionId = (await client.getDocument(id)).collectionId
      } catch {
        // 解析失败仍继续走 ask（reason 里看不到路径也至少让用户确认操作）
      }
      const guard = resolveWriteGuard(await makeClient().listCollections().catch(() => []), collectionId ?? '', getProtected())
      if (guard !== null) return { kind: 'deny', reason: guard }
      const where = docPath !== undefined && docPath.length > 0 ? `路径：${docPath.join(' / ')}` : `文档 id：${id}`
      if (name === 'outline_update_document') {
        const changes = [args.title !== undefined ? '改标题' : '', args.text !== undefined ? '改正文' : ''].filter(Boolean).join(' + ')
        return { kind: 'ask', reason: `将更新 Outline 文档：\n${where}\n变更：${changes}` }
      }
      return { kind: 'ask', reason: `将删除 Outline 文档（第 1 次确认）：\n${where}` }
    }

    return next()
  })
}