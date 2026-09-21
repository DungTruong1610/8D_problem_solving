package cnma.{{module_name}}.domain.__feature__.events;

import com.sap.cds.services.RequestContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OnAfterUpdate{{FeatureName}}Event - AFTER UPDATE event handler.
 * SRP: Handles post-update side effects.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnAfterUpdate{{FeatureName}}Event {

    private final RequestContext requestContext;

    public Object execute(Object _, Object req) {
        String userId = getUserId(req);
        log.info("AFTER UPDATE {{FeatureName}} by user: {}", userId);

        // Post-update logic
        return null;
    }

    private String getUserId(Object req) {
        return "anonymous";
    }
}