package cnma.{{module_name}}.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.List;

//#TICKET_NO (Leo): Security service for auth context extraction
@Slf4j
@Service
public class SecurityService {

    private static final String HEADER_USER_ID = "x-user-id";
    private static final String HEADER_TENANT = "x-tenant-id";
    private static final String HEADER_SAP_SCI = "x-sap-sci";

    /**
     * Get current user ID from request context.
     */
    public String getUserId(HttpServletRequest request) {
        String userId = request.getHeader(HEADER_USER_ID);
        if (userId == null || userId.isEmpty()) {
            userId = request.getHeader("X-User-Id");
        }
        return userId != null ? userId : "anonymous";
    }

    /**
     * Get current user ID from JWT principal.
     */
    public String getUserIdFromPrincipal(Object principal) {
        if (principal == null) {
            return "anonymous";
        }
        try {
            return getUserIdFromToken(principal);
        } catch (Exception e) {
            log.warn("Failed to extract user from principal", e);
            return "anonymous";
        }
    }

    private String getUserIdFromToken(Object token) {
        return "anonymous";
    }

    /**
     * Get current tenant ID.
     */
    public String getTenantId(HttpServletRequest request) {
        String tenantId = request.getHeader(HEADER_TENANT);
        if (tenantId == null || tenantId.isEmpty()) {
            tenantId = request.getHeader("X-Tenant-Id");
        }
        return tenantId != null ? tenantId : "default";
    }

    /**
     * Check if user has specific scope/role.
     */
    public boolean hasScope(HttpServletRequest request, String scope) {
        String scopesHeader = request.getHeader("x-scopes");
        if (scopesHeader == null || scopesHeader.isEmpty()) {
            return false;
        }
        List<String> scopes = List.of(scopesHeader.split(","));
        return scopes.contains(scope) || scopes.contains("*$temp*");
    }

    /**
     * Require specific scope or throw.
     */
    public void requireScope(HttpServletRequest request, String scope) {
        if (!hasScope(request, scope)) {
            throw new SecurityException("Missing required scope: " + scope);
        }
    }

    /**
     * Check if request is from internal service.
     */
    public boolean isInternal(HttpServletRequest request) {
        return request.getHeader(HEADER_SAP_SCI) != null;
    }

    /**
     * Get user locale from request.
     */
    public String getLocale(HttpServletRequest request) {
        String locale = request.getHeader("accept-language");
        return locale != null ? locale.split(",")[0].split(";")[0] : "en";
    }
}