/**
 * ActionResponse - Simple static helper for action responses.
 * Use ApiResponse<T> for complex responses, ActionResponse for simple actions.
 */
export interface SuccessResponse<T> {
    success: true;
    message: string;
    data?: T;
}

export interface ErrorResponse {
    success: false;
    message: string;
}

export class ActionResponse {
    static ok<T>(message: string, data?: T): SuccessResponse<T> {
        return {
            success: true,
            message,
            data,
        };
    }

    static error(message: string): ErrorResponse {
        return {
            success: false,
            message,
        };
    }
}

export default ActionResponse;