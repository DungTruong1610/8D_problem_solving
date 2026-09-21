/**
 * ApiResponse<T> - Standardized API response wrapper.
 * All endpoints MUST return this format.
 */
export class ApiResponse<T> {
    success: boolean;
    message: string;
    data: T | null;

    private constructor(success: boolean, message: string, data: T | null) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    static success<T>(data: T, message = 'Success'): ApiResponse<T> {
        return new ApiResponse(true, message, data);
    }

    static error<T>(message: string, data: T | null = null): ApiResponse<T> {
        return new ApiResponse(false, message, data);
    }

    toJSON() {
        return {
            success: this.success,
            message: this.message,
            data: this.data,
        };
    }
}

/**
 * ServiceResponse<T> - Internal service response with status code.
 */
export class ServiceResponse<T> {
    statusCode: number;
    success: boolean;
    message: string;
    data: T | null;

    constructor(statusCode: number, success: boolean, message: string, data: T | null) {
        this.statusCode = statusCode;
        this.success = success;
        this.message = message;
        this.data = data;
    }

    toApiResponse(): ApiResponse<T> {
        return new ApiResponse(this.success, this.message, this.data);
    }
}

/**
 * ValidationResponse<T> - Validation result wrapper.
 */
export class ValidationResponse<T> {
    valid: boolean;
    message: string;
    errors?: any[];

    constructor(valid: boolean, message: string, errors?: any[]) {
        this.valid = valid;
        this.message = message;
        this.errors = errors;
    }

    toApiResponse(): ApiResponse<T> {
        return new ApiResponse(this.valid, this.message, null);
    }
}