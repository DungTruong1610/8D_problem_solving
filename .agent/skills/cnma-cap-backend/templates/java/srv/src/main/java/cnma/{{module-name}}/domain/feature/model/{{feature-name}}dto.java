package cnma.{{module_name}}.domain.__feature__.model;

import lombok.Data;

/**
 * {{FeatureName}}DTO - Data transfer object for API responses.
 * Separates internal entity from external API contract.
 */
@Data
public class {{FeatureName}}DTO {
    private String id;
    private String createdAt;
    private String createdBy;
    private String modifiedAt;
    private String modifiedBy;
    // Add DTO-specific fields here

    public static {{FeatureName}}DTO fromEntity({{FeatureName}} entity) {
        {{FeatureName}}DTO dto = new {{FeatureName}}DTO();
        dto.setId(entity.getID());
        dto.setCreatedAt(entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null);
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setModifiedAt(entity.getModifiedAt() != null ? entity.getModifiedAt().toString() : null);
        dto.setModifiedBy(entity.getModifiedBy());
        return dto;
    }
}