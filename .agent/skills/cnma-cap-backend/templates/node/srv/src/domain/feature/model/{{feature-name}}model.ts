/**
 * {{FeatureName}}Model - Domain entity interface.
 * Generated from CDS model, extends with domain methods.
 */
export interface I{{FeatureName}} {
    ID?: string;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    // Add domain-specific fields here
}

/**
 * {{FeatureName}}DTO - Data transfer object for API responses.
 * Separates internal entity from external API contract.
 */
export interface I{{FeatureName}}DTO {
    id: string;
    createdAt: string;
    createdBy: string;
    modifiedAt: string;
    modifiedBy: string;
    // Add DTO-specific fields here
}

/**
 * Mapper: Convert entity to DTO
 */
export function toDTO(entity: I{{FeatureName}}): I{{FeatureName}}DTO {
    return {
        id: entity.ID || '',
        createdAt: entity.createdAt || '',
        createdBy: entity.createdBy || '',
        modifiedAt: entity.modifiedAt || '',
        modifiedBy: entity.modifiedBy || '',
    };
}

/**
 * Mapper: Convert DTO to entity
 */
export function toEntity(dto: I{{FeatureName}}DTO): Partial<I{{FeatureName}}> {
    return {
        ID: dto.id,
        createdAt: dto.createdAt,
        createdBy: dto.createdBy,
        modifiedAt: dto.modifiedAt,
        modifiedBy: dto.modifiedBy,
    };
}