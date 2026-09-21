/**
 * DI Container — Dependency Injection wiring for Clean Architecture.
 *
 * CONVENTION:
 * - Place in src/di/
 * - This is the ONLY place where concrete classes are instantiated
 * - All other files import interfaces, never implementations
 * - This file knows about ALL layers (data, domain, presentation)
 *
 * WHY: Makes it trivial to swap implementations (e.g., mock repositories
 * for testing, different API clients for staging vs production).
 *
 * USAGE in components:
 *   import { container } from "../di/container";
 *   const useCase = container.getMyUseCase();
 */
import { HttpClient } from "../data/datasources/HttpClient";
import { EntityRepository } from "../data/repositories/EntityRepository";
// import { GetEntitiesUseCase } from "../domain/usecases/GetEntitiesUseCase";

// ===== DATA SOURCES =====
const httpClient = new HttpClient({
    baseUrl: "/api/srv", // OData service base path
});

// ===== REPOSITORIES =====
const entityRepository = new EntityRepository(httpClient, "/MyEntities");

// ===== USE CASES =====
// const getEntitiesUseCase = new GetEntitiesUseCase(entityRepository);

// ===== EXPORT CONTAINER =====
export const container = {
    // Repositories (exposed for direct use in hooks if needed)
    entityRepository,

    // Use Cases (primary way to access business logic)
    // getEntitiesUseCase,

    // Data Sources (rarely needed outside container)
    httpClient,
};
