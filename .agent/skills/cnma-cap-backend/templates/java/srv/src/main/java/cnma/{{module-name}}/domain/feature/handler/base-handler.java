package cnma.{{module_name}}.domain.__feature__.handler;

import org.springframework.stereotype.Component;

/**
 * BaseHandler - Abstract handler with common utilities.
 * Follows SRP: Handlers only handle event routing, delegate to service.
 */
@Component
public abstract class BaseHandler {

    protected String getUserId(Object user) {
        if (user instanceof cnma.{{module_name}}.infrastructure.security.UserContext) {
            return ((cnma.{{module_name}}.infrastructure.security.UserContext) user).getId();
        }
        return "anonymous";
    }

    protected String getTenantId(Object user) {
        if (user instanceof cnma.{{module_name}}.infrastructure.security.UserContext) {
            return ((cnma.{{module_name}}.infrastructure.security.UserContext) user).getTenant();
        }
        return "default";
    }
}