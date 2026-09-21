import cds from '@sap/cds';

/**
 * OnAfterCreate{{FeatureName}}Event - AFTER CREATE event handler.
 * SRP: Handles post-creation side effects (notifications, logging).
 */
module.exports = {
    execute: async (_, req) => {
        try {
            const userId = req.user?.id || 'anonymous';
            const createdData = req.data;

            // Post-creation logic:
            // - Send notifications
            // - Emit events to message queue
            // - Update related entities
            // - Trigger async workflows

            cds.log('{{FeatureName}} created', {
                userId,
                data: createdData,
                timestamp: new Date().toISOString()
            });

            return createdData;
        } catch (error) {
            cds.log.error('Error in after create {{FeatureName}}: ', error);
        }
    }
};