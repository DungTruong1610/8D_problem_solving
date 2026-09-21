import cds from '@sap/cds';

/**
 * SecurityService - Authentication and authorization helpers.
 * Provides user context and permission checks.
 */
export class SecurityService {
    /**
     * Get current user ID from JWT context.
     */
    static getUserId(req: any): string {
        return req.user?.id || req.headers?.['x-user-id'] || 'anonymous';
    }

    /**
     * Get current user tenant.
     */
    static getTenantId(req: any): string {
        return req.tenant || req.user?.tenant || 'default';
    }

    /**
     * Check if user has specific scope/role.
     */
    static hasScope(req: any, scope: string): boolean {
        const scopes = req.user?.scopes || [];
        return scopes.includes(scope) || scopes.includes('*$temp*');
    }

    /**
     * Require specific scope or throw.
     */
    static requireScope(req: any, scope: string): void {
        if (!this.hasScope(req, scope)) {
            throw new Error(`Missing required scope: ${scope}`);
        }
    }

    /**
     * Check if request is from internal service.
     */
    static isInternal(req: any): boolean {
        return req.headers?.['x-sap-sci'] !== undefined;
    }

    /**
     * Get user locale from JWT.
     */
    static getLocale(req: any): string {
        return req.user?.locale || req.headers?.['accept-language'] || 'en';
    }
}

/**
 * Scopes constants for authorization.
 */
export const SCOPES = {
    READ: 'read',
    WRITE: 'write',
    ADMIN: 'admin',
    AUDIT: 'audit',
};