import cds from '@sap/cds';

/**
 * OnBeforeCreate{{FeatureName}}Event - BEFORE CREATE event handler.
 * SRP: Validates data before creation.
 */
module.exports = {
    execute: async (req) => {
        try {
            const userId = req.user?.id || 'anonymous';
            const data = req.data;

            // Auto-fill UUID if not provided
            if (!data.ID) {
                data.ID = cds.utils.uuid();
            }

            // Set audit fields
            data.createdBy = userId;
            data.modifiedBy = userId;

            // Validation logic here
            if (!data || Object.keys(data).length === 0) {
                req.error(400, 'Invalid data: empty payload');
            }

            // Business validation - check for conflicts
            const conflictQuery = cds
                .select('{{FeatureName}}')
                .where({ createdBy: userId })
                .limit(1);

            const existing = await cds.run(conflictQuery);
            if (existing && existing.length > 0) {
                req.error(409, 'Conflict: record already exists');
            }
        } catch (error) {
            req.error(500, 'Error in before create: ' + error.message);
        }
    }
};