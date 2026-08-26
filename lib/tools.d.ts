import type { OutlineClient } from './client.js';
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
export declare function outlineListCollectionsTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineCreateTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
