/**
 * {{FeatureName}}Handler - Event handler for {{FeatureName}} domain.
 * SRP: Only registers events, delegates logic to event classes.
 */
module.exports = (srv) => {
    // Import event handlers
    const onRead{{FeatureName}}Event = require('../events/OnRead{{FeatureName}}Event');
    const onBeforeCreate{{FeatureName}}Event = require('../events/OnBeforeCreate{{FeatureName}}Event');
    const onAfterCreate{{FeatureName}}Event = require('../events/OnAfterCreate{{FeatureName}}Event');
    const onBeforeUpdate{{FeatureName}}Event = require('../events/OnBeforeUpdate{{FeatureName}}Event');
    const onAfterUpdate{{FeatureName}}Event = require('../events/OnAfterUpdate{{FeatureName}}Event');
    const onAfterDelete{{FeatureName}}Event = require('../events/OnAfterDelete{{FeatureName}}Event');

    // READ Event
    srv.on('READ', '{{FeatureName}}', (req) => {
        return onRead{{FeatureName}}Event.execute(req);
    });

    // CREATE Events
    srv.before('CREATE', '{{FeatureName}}', (req) => {
        return onBeforeCreate{{FeatureName}}Event.execute(req);
    });

    srv.after('CREATE', '{{FeatureName}}', (_, req) => {
        return onAfterCreate{{FeatureName}}Event.execute(_, req);
    });

    // UPDATE Events
    srv.before('UPDATE', '{{FeatureName}}', (req) => {
        return onBeforeUpdate{{FeatureName}}Event.execute(req);
    });

    srv.after('UPDATE', '{{FeatureName}}', (_, req) => {
        return onAfterUpdate{{FeatureName}}Event.execute(_, req);
    });

    // DELETE Events
    srv.after('DELETE', '{{FeatureName}}', (_, req) => {
        return onAfterDelete{{FeatureName}}Event.execute(_, req);
    });
};