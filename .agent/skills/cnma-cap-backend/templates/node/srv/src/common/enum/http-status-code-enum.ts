/**
 * Response helpers for HTTP status codes.
 */
export enum HttpStatusCode {
    OK = 200,
    CREATED = 201,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    INTERNAL_ERROR = 500,
    SERVICE_UNAVAILABLE = 503,
}

/**
 * Success status codes for validation.
 */
export const HTTP_SUCCESS_CODES = [
    HttpStatusCode.OK,
    HttpStatusCode.CREATED,
    HttpStatusCode.NO_CONTENT,
];

/**
 * Client error status codes.
 */
export const HTTP_CLIENT_ERROR_CODES = [
    HttpStatusCode.BAD_REQUEST,
    HttpStatusCode.UNAUTHORIZED,
    HttpStatusCode.FORBIDDEN,
    HttpStatusCode.NOT_FOUND,
    HttpStatusCode.CONFLICT,
    HttpStatusCode.UNPROCESSABLE_ENTITY,
];

/**
 * Map exception code to HTTP status.
 */
export function getHttpStatus(code: string): number {
    const map: Record<string, HttpStatusCode> = {
        VALIDATION_ERROR: HttpStatusCode.BAD_REQUEST,
        NOT_FOUND: HttpStatusCode.NOT_FOUND,
        UNAUTHORIZED: HttpStatusCode.UNAUTHORIZED,
        FORBIDDEN: HttpStatusCode.FORBIDDEN,
        CONFLICT: HttpStatusCode.CONFLICT,
        INTERNAL_ERROR: HttpStatusCode.INTERNAL_ERROR,
    };
    return map[code] || HttpStatusCode.INTERNAL_ERROR;
}