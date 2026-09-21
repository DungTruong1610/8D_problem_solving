/**
 * ServiceException - Domain exception for business logic errors.
 * Never throw plain Error; use ServiceException for controlled failures.
 */
export class ServiceException extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = 'ServiceException';
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
        };
    }
}

/**
 * ValidationException - Thrown when input validation fails.
 */
export class ValidationException extends ServiceException {
    constructor(message: string, details?: any) {
        super('VALIDATION_ERROR', message, details);
        this.name = 'ValidationException';
    }
}

/**
 * NotFoundException - Thrown when entity is not found.
 */
export class NotFoundException extends ServiceException {
    constructor(entity: string, id: string) {
        super('NOT_FOUND', `${entity} with ID ${id} not found`);
        this.name = 'NotFoundException';
    }
}

/**
 * UnauthorizedException - Thrown when auth fails.
 */
export class UnauthorizedException extends ServiceException {
    constructor(message = 'Unauthorized') {
        super('UNAUTHORIZED', message);
        this.name = 'UnauthorizedException';
    }
}

/**
 * Catch block helper - converts unknown to ServiceException.
 */
export function handleError(error: unknown): never {
    if (error instanceof ServiceException) {
        throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ServiceException('INTERNAL_ERROR', message);
}