/**
 * EntityRepository — Data layer implementation of the domain repository interface.
 *
 * CONVENTION:
 * - Place in src/data/repositories/
 * - Implements the domain interface (IEntityRepository)
 * - Uses HttpClient for all API calls (never raw fetch)
 * - Maps API responses to domain entities
 * - Handles error mapping (API errors → domain-friendly messages)
 *
 * DEPENDENCY FLOW:
 *   presentation/ → domain/IEntityRepository → data/EntityRepository → data/HttpClient
 */
import { IEntityRepository } from "../../domain/repositories/IEntityRepository";
import { HttpClient } from "../datasources/HttpClient";

export class EntityRepository<T> implements IEntityRepository<T> {
    private httpClient: HttpClient;
    private basePath: string;

    constructor(httpClient: HttpClient, basePath: string) {
        this.httpClient = httpClient;
        this.basePath = basePath;
    }

    async getAll(): Promise<T[]> {
        const response = await this.httpClient.get<{ value: T[] }>(this.basePath);
        return response.value;
    }

    async getById(id: string): Promise<T | null> {
        try {
            return await this.httpClient.get<T>(`${this.basePath}('${id}')`);
        } catch {
            return null;
        }
    }

    async create(entity: Partial<T>): Promise<T> {
        return this.httpClient.post<T>(this.basePath, entity);
    }

    async update(id: string, entity: Partial<T>): Promise<T> {
        return this.httpClient.patch<T>(`${this.basePath}('${id}')`, entity);
    }

    async delete(id: string): Promise<boolean> {
        try {
            await this.httpClient.delete(`${this.basePath}('${id}')`);
            return true;
        } catch {
            return false;
        }
    }
}
