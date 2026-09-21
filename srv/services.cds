using from './ProresolveService';
using from './ValueHelpService';
using from './AiAdminService';
using from './EightDService';

// Import @cnma/cap-identity backend services & database models
using from '@cnma/cap-identity/db/identity.cds';
using from '@cnma/cap-identity/srv/identity-service.cds';
using from '@cnma/cap-identity/srv/identity-admin-service.cds';

// Import @cnma/cap-valuehelp backend database models
using from '@cnma/cap-valuehelp/db/valuehelp.cds';

// Custom path mapping
annotate IdentityAdminService with @path: '/api/cnma/IDENTITY_SRV' @requires: ['admin', 'Admin'];
annotate IdentityService with @path: '/api/cnma/IDENTITY_USER_SRV';

