import type { OutlineClient } from './client.js';
export declare const SEARCH_MAX_LIMIT = 25;
export declare const DOCUMENT_DEFAULT_MAX_LENGTH = 20000;
export declare const DOCUMENT_MAX_LENGTH_CAP = 200000;
export declare function outlineSearchTool(makeClient: () => OutlineClient, defaultLimit: number): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function outlineGetDocumentTool(makeClient: () => OutlineClient): import("@deepseek-ai/dsh-tools").ToolDefinition;
