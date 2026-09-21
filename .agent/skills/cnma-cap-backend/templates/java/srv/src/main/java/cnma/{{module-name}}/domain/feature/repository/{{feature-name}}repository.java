package cnma.{{module_name}}.domain.__feature__.repository;

import org.springframework.stereotype.Repository;
import com.sap.cds.services.persistence.PersistenceService;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Optional;

/**
 * {{FeatureName}}Repository - Data access layer.
 * SRP: Only handles CQN queries, no business logic.
 */
@Repository
@RequiredArgsConstructor
public class {{FeatureName}}Repository {

    private final PersistenceService persistence;

    public List<{{FeatureName}}> findByUserId(String userId) {
        return List.of(); // Implementation with CDS CQN
    }

    public Optional<{{FeatureName}}> findById(String id) {
        return Optional.empty(); // Implementation with CDS CQN
    }

    public {{FeatureName}} create({{FeatureName}} data) {
        return null; // Implementation with CDS CQN
    }

    public int update(String id, {{FeatureName}} data) {
        return 0; // Implementation with CDS CQN
    }

    public void delete(String id) {
        // Implementation with CDS CQN
    }
}