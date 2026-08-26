import type { OutlineClient, OutlineCollection } from './client.js';
export declare const SEARCH_MAX_LIMIT = 25;
export declare const DOCUMENT_DEFAULT_MAX_LENGTH = 20000;
export declare const DOCUMENT_MAX_LENGTH_CAP = 200000;
export declare function outlineSearchTool(makeClient: () => OutlineClient, defaultLimit: number): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineCountTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineGetDocumentTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** 审批提示文案：集合名 + 标题 + 内容预览（前 100 字，纯函数可单测）。 */
export declare function buildCreateApprovalReason(args: {
    collectionId?: string;
    title?: string;
    text?: string;
}, collectionName?: string): string;
/** 禁止写入的集合名（精确匹配，去除首尾空白）。命中即拒绝 outline_create，即使审批也不会放行。 */
export declare const FORBIDDEN_WRITE_COLLECTIONS: readonly string[];
/**
 * 写入守卫：按集合名判断是否允许创建文档。
 * @returns 禁止时返回错误提示文案；允许时返回 null。
 */
export declare function resolveWriteGuard(collections: OutlineCollection[], collectionId: string): string | null;
export declare function outlineListCollectionsTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineCreateTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
