/**
 * UseCase — Concrete business logic implementation.
 *
 * CONVENTION:
 * - Place in src/domain/usecases/
 * - One class per use case (Single Responsibility)
 * - Implements IUseCase<Input, Output>
 * - Receives repository interface via constructor (Dependency Inversion)
 * - Returns Result<T> for consistent error handling
 * - Contains ZERO UI logic, ZERO HTTP calls
 *
 * NAMING: {Verb}{Entity}UseCase — e.g., GetDocumentsUseCase, CreateOrderUseCase
 */
import { IUseCase } from "../../core/IUseCase";
import { Result } from "../../core/Result";
import { IEntityRepository } from "../repositories/IEntityRepository";

// Define input/output types for this specific use case
interface GetAllEntitiesInput {
    filter?: string;
    limit?: number;
}

interface Entity {
    id: string;
    name: string;
    // ... entity fields
}

export class GetAllEntitiesUseCase implements IUseCase<GetAllEntitiesInput, Entity[]> {
    private repository: IEntityRepository<Entity>;

    constructor(repository: IEntityRepository<Entity>) {
        this.repository = repository;
    }

    async execute(input: GetAllEntitiesInput): Promise<Result<Entity[]>> {
        try {
            const entities = await this.repository.getAll();

            // Business logic: apply filtering, sorting, validation here
            let result = entities;
            if (input.limit) {
                result = entities.slice(0, input.limit);
            }

            return Result.ok(result);
        } catch (error: any) {
            return Result.fail(error.message || "Failed to retrieve entities");
        }
    }
}
