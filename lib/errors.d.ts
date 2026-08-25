export type OutlineErrorKind = 'auth' | 'not-found' | 'rate-limited' | 'api' | 'network' | 'invalid-response';
export declare class OutlineApiError extends Error {
    readonly kind: OutlineErrorKind;
    readonly status: number | null;
    constructor(kind: OutlineErrorKind, message: string, status?: number | null);
}
export declare function throwForStatus(status: number, bodyText: string): never;
