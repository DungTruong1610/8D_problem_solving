import cds from '@sap/cds';

/**
 * OnAfterDelete{{FeatureName}}Event - AFTER DELETE event handler.
 * SRP: Handles post-deletion cleanup.
 */
module.exports = {
    execute: async (_, req) => {
        try {
            const userId = req.user?.id || 'anonymous';
            const deletedId = req.params?.[0];

            cds.log('{{FeatureName}} deleted', {
                userId,
                deletedId,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            cds.log.error('Error in after delete {{FeatureName}}: ', error);
        }
    }
};