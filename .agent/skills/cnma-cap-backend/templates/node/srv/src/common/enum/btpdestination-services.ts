/**
 * BTP Destination Service types
 */
export enum EBTPDestinationServices {
    DESTINATION_SERVICE = 'destination',
    AUTH_TOKEN_SERVICE = 'token',
    CONNECTIVIVTY_SERVICE = 'connectivity',
}

/**
 * Destination configuration keys
 */
export const BTP_DESTINATION_KEYS = {
    URL: 'URL',
    USER: 'User',
    PASSWORD: 'Password',
    CLIENT_ID: 'clientid',
    CLIENT_SECRET: 'clientsecret',
    TOKEN_SERVICE_URL: 'tokenServiceURL',
    TOKEN_SERVICE_URL_TYPE: 'tokenServiceURLType',
    AUTHENTICATION: 'authentication',
} as const;

/**
 * Default timeout for destination calls (ms)
 */
export const BTP_DESTINATION_TIMEOUT = 30000;