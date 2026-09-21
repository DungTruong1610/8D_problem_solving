package cnma.{{module_name}}.domain.__feature__.events;

import com.sap.cds.services.RequestContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OnBeforeUpdate{{FeatureName}}Event - BEFORE UPDATE event handler.
 * SRP: Validates data before update, sets audit fields.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnBeforeUpdate{{FeatureName}}Event {

    private final RequestContext requestContext;

    public void execute(Object req) {
        String userId = getUserId(req);
        log.debug("BEFORE UPDATE {{FeatureName}} by user: {}", userId);

        // Set audit fields (modifiedBy, modifiedAt)
        // Validate data
        // Check if record exists
    }

    private String getUserId(Object req) {
        return "anonymous";
    }
}