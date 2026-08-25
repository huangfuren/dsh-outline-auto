import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { Config } from './config.js';
import { OutlineClient } from './client.js';
import { outlineSearchTool, outlineGetDocumentTool } from './tools.js';
export const name = 'dsh-outline-ai';
export const inject = ['tools'];
/** GUI 设置命名空间（设置 → 插件 → 插件配置 的卡片读写它，持久化在 settings.yaml）。 */
const SETTINGS_NS = settingsNamespace('outline-ai');
export function apply(ctx, config = {}) {
    // 当前生效的连接配置：GUI 设置（settings.yaml 用户层）优先，其次环境变量。
    // installSettingsSection 在 settings 服务存在时把 thunk 指向解析后的命名空间值，
    // 用户层未覆盖时回落到本插件配置行（patch config）与 schema 默认值。
    let settingsSource = () => ({ ...config });
    const makeClient = () => {
        const s = settingsSource();
        const baseUrl = (s.baseUrl ?? '').trim() || (process.env.OUTLINE_BASE_URL ?? '').trim();
        const apiToken = (s.apiToken ?? '').trim() || (process.env.OUTLINE_API_TOKEN ?? '').trim();
        if (!baseUrl || !apiToken) {
            throw new Error('dsh-outline-ai 未配置：需要 baseUrl 与 apiToken（可在 设置 → 插件 → 插件配置 填写，或环境变量 OUTLINE_BASE_URL / OUTLINE_API_TOKEN）。配置方法见插件 README。');
        }
        return new OutlineClient({ baseUrl, apiToken, timeoutMs: config.timeoutMs ?? 15000 });
    };
    installSettingsSection(ctx, SETTINGS_NS, Config, config, {
        setSource: (current) => {
            settingsSource = current;
        },
        onChange: () => { },
    });
    ctx.tools.register(outlineSearchTool(makeClient, config.searchLimit ?? 10));
    ctx.tools.register(outlineGetDocumentTool(makeClient));
}
