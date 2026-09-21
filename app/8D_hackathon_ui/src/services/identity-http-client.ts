import axiosInstance from '@/services/core/axios-instance';
import type { IdentityHttpClient } from '@cnma/cap-identity/react';

/**
 * IdentityHttpClient adapter wrapping the application's shared Axios instance.
 *
 * This satisfies the HTTP contract required by @cnma/cap-identity components
 * (OrganizationManager, UserPreferencesPage, UserPreferencesDialog).
 */
export const identityHttpClient: IdentityHttpClient = {
    get: async <T = any>(url: string): Promise<T> => {
        const response = await axiosInstance.get<T>(url);
        return response.data;
    },
    post: async <T = any>(url: string, data?: any): Promise<T> => {
        const response = await axiosInstance.post<T>(url, data);
        return response.data;
    },
    patch: async <T = any>(url: string, data?: any): Promise<T> => {
        const response = await axiosInstance.patch<T>(url, data);
        return response.data;
    },
    delete: async <T = any>(url: string): Promise<T> => {
        const response = await axiosInstance.delete<T>(url);
        return response.data;
    },
};

export interface UserSettingsExpanded {
    ID: string;
    theme_ID?: string;
    language_ID?: string;
    theme?: {
        ID: string;
        code: string;
        name: string;
    };
    language?: {
        ID: string;
        code: string;
        name: string;
    };
}

export const IDENTITY_SERVICE_PATH = '/api/cnma/IDENTITY_USER_SRV';

export const identityService = {
    getUserSettingsExpanded: async (): Promise<UserSettingsExpanded[]> => {
        const response = await identityHttpClient.get<{ value: UserSettingsExpanded[] }>(
            `${IDENTITY_SERVICE_PATH}/UserSettings?$expand=theme,language`
        );
        return response?.value || [];
    },
};

export default identityHttpClient;
