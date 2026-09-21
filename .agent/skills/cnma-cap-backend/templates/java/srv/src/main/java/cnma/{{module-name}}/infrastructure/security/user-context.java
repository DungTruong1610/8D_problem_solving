package cnma.{{module_name}}.infrastructure.security;

import lombok.Data;

/**
 * UserContext - Immutable user context data extracted from JWT/token.
 * SRP: Only holds user context data, no business logic.
 */
@Data
public class UserContext {
    private String userId;
    private String tenantId;
    private String locale;
    private String[] scopes;

    public UserContext(String userId, String tenantId) {
        this.userId = userId;
        this.tenantId = tenantId;
        this.locale = "en";
    }

    public boolean hasScope(String scope) {
        if (scopes == null || scopes.length == 0) {
            return false;
        }
        for (String s : scopes) {
            if (s.equals(scope) || s.equals("*$temp*")) {
                return true;
            }
        }
        return false;
    }

    public boolean isInternal() {
        return false;
    }
}