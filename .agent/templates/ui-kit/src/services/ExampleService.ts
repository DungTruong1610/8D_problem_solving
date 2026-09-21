import { api } from '../lib/api';

/**
 * Example Service to encapsulate API calls
 * Follow this pattern for all data fetching.
 */
export const ExampleService = {
    async getItems(): Promise<any[]> {
        const response = await api.get('/api/items');
        return response.data;
    },

    async createItem(data: any): Promise<any> {
        const response = await api.post('/api/items', data);
        return response.data;
    }
};
