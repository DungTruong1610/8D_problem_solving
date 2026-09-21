import cds from '@sap/cds';

/**
 * OnAfterUpdate{{FeatureName}}Event - AFTER UPDATE event handler.
 * SRP: Handles post-update side effects.
 */
module.exports = {
    execute: async (_, req) => {
        try {
            const userId = req.user?.id || 'anonymous';
            const updatedData = req.data;

            cds.log('{{FeatureName}} updated', {
                userId,
                data: updatedData,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            cds.log.error('Error in after update {{FeatureName}}: ', error);
        }
    }
};