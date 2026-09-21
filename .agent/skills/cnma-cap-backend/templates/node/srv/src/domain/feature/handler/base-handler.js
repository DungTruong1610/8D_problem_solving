import { ApplicationService } from '@sap/cds/apis/services';

/**
 * BaseHandler - Abstract handler with common utilities.
 * SRP: Handler only registers events, logic goes to events/.
 */
export abstract class BaseHandler {
    constructor(protected readonly srv: ApplicationService) {}

    protected getUserId(req: any): string {
        return req.user?.id || 'anonymous';
    }

    protected getTenantId(req: any): string {
        return req.tenant || 'default';
    }
}