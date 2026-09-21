/**
 * <Module> Service
 *
 * Location: server/src/services/<module>.service.ts
 *
 * SRP: business logic only.
 *  - Orchestrates repository calls.
 *  - Enforces business rules (validation beyond shape, cross-entity checks).
 *  - NEVER touches req/res. NEVER calls Mongoose directly.
 *
 * DIP: depends on I<Module>Repository + I<Module>Mapper interfaces only.
 *       Concrete classes are wired in composition/container.ts.
 *
 * ISP: implements I<Module>ReadService & I<Module>WriteService. Split further
 *      if image upload / bulk / analytics etc. grow too large.
 *
 * LSP: every method honors its interface contract. Throws only typed AppError
 *      subclasses listed in the interface's JSDoc.
 */

import type {
  I<Module>ReadService,
  I<Module>WriteService,
  I<Module>Repository,
  I<Module>Mapper,
  <Module>CreateInput,
  <Module>UpdateInput,
  <Module>DTO,
  <Module>Filter,
} from '../interfaces/<module>.interfaces.js';
import { NotFoundError } from '../errors/NotFoundError.js';

export class <Module>Service implements I<Module>ReadService, I<Module>WriteService {
  constructor(
    private readonly repo: I<Module>Repository,
    private readonly mapper: I<Module>Mapper,
  ) {}

  // ───────────────────────────── READ ─────────────────────────────

  async getAll(filter: <Module>Filter, userEmail: string): Promise<<Module>DTO[]> {
    const mongoFilter = this.buildMongoFilter(filter, userEmail);
    const docs = await this.repo.findAll(mongoFilter);
    return this.mapper.toDTOList(docs);
  }

  async getById(id: string, userEmail: string): Promise<<Module>DTO> {
    const doc = await this.repo.findById(id, userEmail);
    if (!doc) throw new NotFoundError('<Module>');
    return this.mapper.toDTO(doc);
  }

  // ───────────────────────────── WRITE ────────────────────────────

  async create(input: <Module>CreateInput, userEmail: string): Promise<<Module>DTO> {
    const data = this.mapper.toCreateData(input, userEmail);
    const doc = await this.repo.create(data);
    return this.mapper.toDTO(doc);
  }

  async update(
    id: string,
    input: <Module>UpdateInput,
    userEmail: string,
  ): Promise<<Module>DTO> {
    const data = this.mapper.toUpdateData(input);
    const doc = await this.repo.update(id, userEmail, data);
    if (!doc) throw new NotFoundError('<Module>');
    return this.mapper.toDTO(doc);
  }

  async delete(id: string, userEmail: string): Promise<<Module>DTO> {
    const doc = await this.repo.delete(id, userEmail);
    if (!doc) throw new NotFoundError('<Module>');
    return this.mapper.toDTO(doc);
  }

  // ───────────────────────── PURE HELPERS ─────────────────────────
  // Keep these private + pure so they are trivially unit-testable.

  private buildMongoFilter(filter: <Module>Filter, userEmail: string): Record<string, unknown> {
    const mongoFilter: Record<string, unknown> = { userEmail };

    if (filter.year && filter.month) {
      const datePrefix = `${filter.year}-${String(filter.month).padStart(2, '0')}`;
      mongoFilter.date = { $regex: `^${datePrefix}` };
    }
    // ...add other filter translations here
    return mongoFilter;
  }
}
