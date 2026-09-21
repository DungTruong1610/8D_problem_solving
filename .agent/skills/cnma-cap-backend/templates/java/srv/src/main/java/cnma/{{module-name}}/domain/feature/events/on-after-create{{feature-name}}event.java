package cnma.{{module_name}}.domain.__feature__.events;

import com.sap.cds.services.RequestContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OnAfterCreate{{FeatureName}}Event - AFTER CREATE event handler.
 * SRP: Handles post-creation side effects.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnAfterCreate{{FeatureName}}Event {

    private final RequestContext requestContext;

    public Object execute(Object _, Object req) {
        String userId = getUserId(req);
        log.info("AFTER CREATE {{FeatureName}} by user: {}", userId);

        // Post-creation logic:
        // - Send notifications
        // - Emit events to message queue
        // - Update related entities
        return null;
    }

    private String getUserId(Object req) {
        return "anonymous";
    }
}