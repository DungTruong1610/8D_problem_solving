/**
 * OData Response Types — CAP OData V4
 */

export interface ODataResponse<T> {
    value: T[];
    '@odata.count'?: number;
    '@odata.nextLink'?: string;
}

export interface ODataSingleResponse<T> {
    value: T;
}

export interface ODataError {
    error: {
        code: string;
        message: string;
        details?: Array<{
            code: string;
            message: string;
            target?: string;
        }>;
    };
}
