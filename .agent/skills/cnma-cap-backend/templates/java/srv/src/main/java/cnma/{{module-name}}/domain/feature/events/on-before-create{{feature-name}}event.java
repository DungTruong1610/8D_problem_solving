package cnma.{{module_name}}.domain.__feature__.events;

import com.sap.cds.services.RequestContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * OnBeforeCreate{{FeatureName}}Event - BEFORE CREATE event handler.
 * SRP: Validates data before creation, sets audit fields.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnBeforeCreate{{FeatureName}}Event {

    private final RequestContext requestContext;

    public void execute(Object req) {
        String userId = getUserId(req);
        log.debug("BEFORE CREATE {{FeatureName}} by user: {}", userId);

        // Auto-fill UUID if not provided
        // Set audit fields (createdBy, modifiedBy)
        // Validate data
        // Check for conflicts
    }

    private String getUserId(Object req) {
        return "anonymous";
    }
}