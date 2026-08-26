import type { OutlineClient, OutlineCollection } from './client.js';
export declare const SEARCH_MAX_LIMIT = 25;
export declare const DOCUMENT_DEFAULT_MAX_LENGTH = 20000;
export declare const DOCUMENT_MAX_LENGTH_CAP = 200000;
export declare function outlineSearchTool(makeClient: () => OutlineClient, defaultLimit: number): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineCountTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineGetDocumentTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** 审批提示文案：完整路径 + 标题 + 内容预览（前 100 字，纯函数可单测）。 */
export declare function buildCreateApprovalReason(args: {
    collectionId?: string;
    title?: string;
    text?: string;
}, collectionName?: string, resolvedPath?: string[]): string;
/** 默认受保护集合（settings 未配置时的兜底）。 */
export declare const FORBIDDEN_WRITE_COLLECTIONS: readonly string[];
/** 写工具守卫来源：返回当前受保护集合名列表。 */
export interface WriteGuards {
    protectedCollections: () => string[];
}
/** 团队标准需求文档模板（Markdown，依据团队规范的需求对齐模板 v4）。
 * 排版约定：条目类章节（需求或目标/交付物/交付标准/潜在风险点/工作思路）如有多个条目，
 * 必须换行并逐条编号（1、2、3、… 一点一行），不要挤成一段。 */
export declare const REQUIREMENT_DOC_TEMPLATE: string;
/** 模板的章节清单（供 AI 核对是否写全）。 */
export declare const REQUIREMENT_DOC_SECTIONS: string[];
export declare function outlineDocTemplateTool(): import("@deepseek-ai/dsh-tools").ToolDefinition;
/**
 * 写入守卫：按集合名判断是否允许写入（创建/更新/删除）。
 * @returns 禁止时返回错误提示文案；允许时返回 null。
 */
export declare function resolveWriteGuard(collections: OutlineCollection[], collectionId: string, protectedList: string[]): string | null;
export declare function outlineResolvePathTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineListCollectionsTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineCreateTool(makeClient: () => OutlineClient, getProtected: () => string[]): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineUpdateDocumentTool(makeClient: () => OutlineClient, getProtected: () => string[]): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** 二次审批回调：由 index.ts 接线到 ctx.approval.request，返回是否 allowed-once。 */
export type DeleteApprovalRequester = (reason: string, exec: {
    agent?: unknown;
    callId?: unknown;
}) => Promise<boolean>;
export declare function outlineDeleteTool(makeClient: () => OutlineClient, getProtected: () => string[], requestApproval: DeleteApprovalRequester): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineListChildrenTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
