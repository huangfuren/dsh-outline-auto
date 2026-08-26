import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { Config } from './config.js';
import { OutlineClient } from './client.js';
import { outlineSearchTool, outlineGetDocumentTool, outlineCountTool, outlineListCollectionsTool, outlineCreateTool, buildCreateApprovalReason } from './tools.js';
export const name = 'dsh-outline-auto';
export const inject = ['tools'];
/** GUI 设置命名空间（设置 → 插件 → 插件配置 的卡片读写它，持久化在 settings.yaml）。 */
const SETTINGS_NS = settingsNamespace('outline-auto');
export function apply(ctx, config = {}) {
    // 连接配置优先级（与 README 一致）：GUI 卡片（settings.yaml 用户层）→ 环境变量 → 插件配置行。
    // settings 注册时 base 传空对象，使解析值只反映 GUI 用户层，环境变量与配置行在下方回退。
    let settingsSource = () => ({});
    const makeClient = () => {
        const s = settingsSource();
        const baseUrl = (s.baseUrl ?? '').trim()
            || (process.env.OUTLINE_BASE_URL ?? '').trim()
            || (config.baseUrl ?? '').trim();
        const apiToken = (s.apiToken ?? '').trim()
            || (process.env.OUTLINE_API_TOKEN ?? '').trim()
            || (config.apiToken ?? '').trim();
        if (!baseUrl || !apiToken) {
            throw new Error('dsh-outline-auto 未配置：需要 baseUrl 与 apiToken（可在 设置 → 插件 → 插件配置 填写，或环境变量 OUTLINE_BASE_URL / OUTLINE_API_TOKEN）。配置方法见插件 README。');
        }
        return new OutlineClient({ baseUrl, apiToken, timeoutMs: config.timeoutMs ?? 15000 });
    };
    installSettingsSection(ctx, SETTINGS_NS, Config, {}, {
        setSource: (current) => {
            settingsSource = current;
        },
        onChange: () => { },
    });
    ctx.tools.register(outlineSearchTool(makeClient, config.searchLimit ?? 10));
    ctx.tools.register(outlineGetDocumentTool(makeClient));
    ctx.tools.register(outlineCountTool(makeClient));
    ctx.tools.register(outlineListCollectionsTool(makeClient));
    ctx.tools.register(outlineCreateTool(makeClient));
    // 写工具审批闸：仅 outline_create 需用户确认；其余工具放行。
    ctx.on('tools/pre-execute', async (exec, next) => {
        if (exec.name !== 'outline_create')
            return next();
        const args = (exec.arguments ?? {});
        let collectionName;
        try {
            const collections = await makeClient().listCollections();
            collectionName = collections.find((c) => c.id === args.collectionId)?.name;
        }
        catch {
            collectionName = undefined; // 查不到集合名时退回 collectionId
        }
        return { kind: 'ask', reason: buildCreateApprovalReason(args, collectionName) };
    });
}
