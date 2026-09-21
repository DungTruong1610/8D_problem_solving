package cnma.{{module_name}}.domain.__feature__.events;

import com.sap.cds.services.RequestContext;
import com.sap.cds.ql.Select;
import com.sap.cds.Result;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OnRead{{FeatureName}}Event - READ event handler.
 * SRP: Only handles READ logic, delegates persistence to Repository.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnRead{{FeatureName}}Event {

    private final RequestContext requestContext;

    public Object execute(Object req) {
        // Extract user context
        String userId = getUserId(req);
        log.debug("READ {{FeatureName}} by user: {}", userId);

        // Extract query conditions from request
        // Combine with predefined conditions (e.g., filter by user)
        // Execute query and return results
        return null;
    }

    private String getUserId(Object req) {
        return "anonymous";
    }
}