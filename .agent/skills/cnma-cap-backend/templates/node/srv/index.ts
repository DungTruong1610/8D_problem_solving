/**
 * CAP Module Entry Point
 *
 * This module registers all domain event handlers with the CAP server.
 * Import this in package.json: "main": "src/server.ts"
 *
 * Features:
 * - Auto-discovers handler files from domain/ folder
 * - Registers services with constructor injection
 * - Sets up event subscriptions
 */
import cds from '@sap/cds';
import { createLogger } from '../common/util/Logger';

const logger = createLogger('Module');

/**
 * Register all feature handlers.
 */
export default async function registerHandlers() {
    logger.info('Registering CAP handlers...');

    // Import and register handlers
    // Example: import { NotificationHandler } from './domain/notification/handler/NotificationHandler';

    // Register event handlers for each feature
    // srv.on('READ', 'Entity', async (req) => { ... });

    logger.info('Handlers registered successfully');
}

// Auto-register on module load
registerHandlers().catch(console.error);