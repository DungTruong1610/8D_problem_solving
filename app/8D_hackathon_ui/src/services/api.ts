/**
 * @deprecated Use `axiosInstance` from `@/services` instead.
 * This file is kept for backward compatibility only.
 *
 * The full-featured instance (CSRF fetch+retry, 401/403 handling) lives at:
 *   src/services/core/axiosInstance.ts
 */
export { default as api } from './core/axios-instance';
export { default } from './core/axios-instance';

