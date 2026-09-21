import axios from 'axios';
import { globalEvents, EVENT_TYPES } from './events';

export const api = axios.create({
    baseURL: '/', // Relative URL to use proxy
    headers: {
        'Content-Type': 'application/json',
    }
});

// Add interceptor for response errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.error?.message || error.message || 'An unknown error occurred';
        console.error('API Error:', message);

        // Emit global event for Toast
        globalEvents.emit(EVENT_TYPES.API_ERROR, message);

        return Promise.reject(error);
    }
);
