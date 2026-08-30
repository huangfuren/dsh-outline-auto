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
/** 白名单条目：一个可写目录路径。segments 为空表示整个集合可写。 */
export interface WritablePathEntry {
    collectionName: string;
    segments: string[];
}
/** 解析可写目录配置（逗号分隔）：`集合名` 或 `集合名/目录A/子目录B`。 */
export declare function parseWritablePaths(raw: string): WritablePathEntry[];
/** 写入目标的两种形态：创建（目标位置）与更新/删除（目标文档）。 */
export type WritePathTarget = {
    kind: 'create';
    collectionId: string;
    parentDocumentId?: string;
} | {
    kind: 'doc';
    docId: string;
};
/**
 * 目录级写入守卫：目标路径必须落在白名单条目内（前缀匹配，fail-closed）。
 * - 白名单为空 → 拒绝（插件为只读模式）
 * - 目标路径解析失败（集合/文档不可见）→ 拒绝
 * - 条目 `集合A/目录1` 匹配 `[集合A, 目录1, …任意子级]`；`集合A` 匹配整个集合
 * @returns 禁止或无法确认时返回错误提示文案；允许时返回 null。
 */
export declare function resolvePathGuard(client: OutlineClient, target: WritePathTarget, entries: WritablePathEntry[], collections: OutlineCollection[]): Promise<string | null>;
/** 团队标准需求文档模板（Markdown，依据团队标准需求对齐模板 v4）。
 * 排版约定：条目类章节（需求或目标/交付物/交付标准/潜在风险点/工作思路）如有多个条目，
 * 必须换行并逐条编号（1、2、3、… 一点一行），不要挤成一段。 */
export declare const REQUIREMENT_DOC_TEMPLATE: string;
/** 模板的章节清单（供 AI 核对是否写全）。 */
export declare const REQUIREMENT_DOC_SECTIONS: string[];
export declare function outlineDocTemplateTool(): import("@deepseek-ai/dsh-tools").ToolDefinition;
/**
 * 基础写入守卫：必须确认集合存在且 token 有写权限。
 * @returns 禁止或无法确认时返回错误提示文案；允许时返回 null。
 */
export declare function resolveWriteGuard(collections: OutlineCollection[], collectionId: string): string | null;
export declare function outlineResolvePathTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineListCollectionsTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineCreateTool(makeClient: () => OutlineClient, getWritablePaths: () => string): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineUpdateDocumentTool(makeClient: () => OutlineClient, getWritablePaths: () => string): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** 二次审批回调：由 index.ts 接线到 ctx.approval.request，返回是否 allowed-once。 */
export type DeleteApprovalRequester = (reason: string, exec: {
    agent?: unknown;
    callId?: unknown;
}) => Promise<boolean>;
export declare function outlineDeleteTool(makeClient: () => OutlineClient, getWritablePaths: () => string, requestApproval: DeleteApprovalRequester): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineListChildrenTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
