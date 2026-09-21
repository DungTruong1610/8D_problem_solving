import cds from '@sap/cds';

/**
 * OnRead{{FeatureName}}Event - READ event handler for {{FeatureName}} domain.
 * SRP: Contains only READ logic, no business rules.
 */
module.exports = {
    execute: async (req) => {
        try {
            const userId = req.user?.id || 'anonymous';

            // Extract query conditions from incoming request
            let reqConditions = req.query?.SELECT?.where || [];

            // Predefined conditions (e.g., filter by user)
            const predefinedConditions = [
                { ref: ['createdBy'] }, '=', { val: userId }
            ];

            // Combine request conditions with predefined ones
            let combinedCondition;
            if (reqConditions.length > 0) {
                combinedCondition = ['(', ...reqConditions, ')', 'and', ...predefinedConditions];
            } else {
                combinedCondition = predefinedConditions;
            }

            // Execute query with combined conditions
            const query = cds.query;
            let selectQuery = cds
                .select('{{FeatureName}}')
                .columns('*')
                .where(combinedCondition);

            const results = await cds.run(selectQuery);
            return results;
        } catch (error) {
            req.error(500, 'Error reading {{FeatureName}}: ' + error.message);
        }
    }
};