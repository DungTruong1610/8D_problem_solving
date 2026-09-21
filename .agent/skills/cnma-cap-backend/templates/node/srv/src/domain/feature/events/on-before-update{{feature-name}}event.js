import cds from '@sap/cds';

/**
 * OnBeforeUpdate{{FeatureName}}Event - BEFORE UPDATE event handler.
 * SRP: Validates data before update.
 */
module.exports = {
    execute: async (req) => {
        try {
            const userId = req.user?.id || 'anonymous';
            const data = req.data;

            // Set audit field
            data.modifiedBy = userId;
            data.modifiedAt = new Date();

            // Validation logic here
            if (!data || Object.keys(data).length === 0) {
                req.error(400, 'Invalid data: empty payload');
            }

            // Check if record exists
            const recordId = req.params?.[0];
            if (recordId) {
                const existing = await cds.run(
                    cds.select('{{FeatureName}}').where({ ID: recordId })
                );
                if (!existing || existing.length === 0) {
                    req.error(404, 'Record not found');
                }
            }
        } catch (error) {
            req.error(500, 'Error in before update: ' + error.message);
        }
    }
};