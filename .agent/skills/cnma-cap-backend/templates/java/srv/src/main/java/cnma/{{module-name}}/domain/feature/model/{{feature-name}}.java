package cnma.{{module_name}}.domain.__feature__.model;

import lombok.Data;
import java.time.LocalDateTime;

/**
 * {{FeatureName}} - Domain entity interface.
 * Generated from CDS model, extended with domain methods.
 */
@Data
public class {{FeatureName}} {
    private String ID;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime modifiedAt;
    private String modifiedBy;
    // Add domain-specific fields here
}