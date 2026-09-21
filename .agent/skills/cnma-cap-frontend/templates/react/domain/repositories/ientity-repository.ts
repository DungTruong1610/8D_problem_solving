/**
 * IRepository — Base repository interface in the DOMAIN layer.
 *
 * CONVENTION:
 * - Place in src/domain/repositories/
 * - Define one interface per entity/aggregate root
 * - The domain layer ONLY knows about this interface, never the implementation
 * - Implementation lives in src/data/repositories/
 *
 * This enforces Dependency Inversion:
 *   domain/ defines the contract → data/ implements it → di/ wires them together
 */

export interface IEntityRepository<T> {
    getAll(): Promise<T[]>;
    getById(id: string): Promise<T | null>;
    create(entity: Partial<T>): Promise<T>;
    update(id: string, entity: Partial<T>): Promise<T>;
    delete(id: string): Promise<boolean>;
}

/**
 * Example: Domain-specific repository extending the base
 *
 * export interface IDocumentRepository extends IEntityRepository<Document> {
 *     searchByContent(query: string): Promise<Document[]>;
 *     getByCategory(categoryId: string): Promise<Document[]>;
 * }
 */
