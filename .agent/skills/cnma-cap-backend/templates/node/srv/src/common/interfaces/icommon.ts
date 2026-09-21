/**
 * Common interfaces for CAP services.
 * Shared across all features.
 */
export interface ICustomRequest extends Request { }

export interface Managed {
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
}

export interface IApiResponse<T> {
    success: boolean;
    message: string;
    data: T | null;
}

export interface IServiceResponse<T> extends IApiResponse<T> {
    statusCode: number;
    toApiResponse(): IApiResponse<T>;
}

export interface IResponseData<T> {
    message: string;
    data: T | null;
}

export interface IValidationResponseData<T> {
    valid: boolean;
    message: string;
    toApiResponse(): IApiResponse<T>;
}

export interface IBulkUpdateData {
    condition: any;
    data: any;
}

export interface ICommonService {
    getText(textKey: string, params?: string[]): string;
    buildServiceResponse<T>(statusCode: number, message: string, data?: T): IServiceResponse<T>;
    buildValidationResponse<T>(valid: boolean, message: string): IValidationResponseData<T>;
    setCreateManaged(data: any, owner: string): void;
    setUpdateManaged(data: any, owner: string): void;
}

export interface IDestinationCloudService {
    getBTPDestination(destinationName: string): Promise<any | null>;
    fetchJwtToken(authTokenUrl: string, clientId: string, clientSecret: string): Promise<string>;
    getAuthorizationTokenForSystemUser(destinationName: string): Promise<string>;
}

export interface ILogEntry {
    destinationName: string;
    method: string;
    url: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    statusCode?: number;
    success?: boolean;
    error?: string;
}