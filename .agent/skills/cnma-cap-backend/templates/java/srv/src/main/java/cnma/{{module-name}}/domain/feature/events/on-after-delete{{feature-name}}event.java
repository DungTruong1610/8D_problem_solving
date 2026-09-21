package cnma.{{module_name}}.domain.__feature__.events;

import com.sap.cds.services.RequestContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OnAfterDelete{{FeatureName}}Event - AFTER DELETE event handler.
 * SRP: Handles post-deletion cleanup.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnAfterDelete{{FeatureName}}Event {

    private final RequestContext requestContext;

    public Object execute(Object _, Object req) {
        String userId = getUserId(req);
        log.info("AFTER DELETE {{FeatureName}} by user: {}", userId);

        // Post-deletion cleanup
        return null;
    }

    private String getUserId(Object req) {
        return "anonymous";
    }
}