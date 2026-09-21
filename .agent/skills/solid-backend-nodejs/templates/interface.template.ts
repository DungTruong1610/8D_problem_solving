/**
 * Interface Contracts for <Module>
 *
 * Location: server/src/interfaces/<module>.interfaces.ts
 *
 * RULES:
 *  - Split fat interfaces (ISP). Prefer I<Module>ReadService + I<Module>WriteService
 *    over a single I<Module>Service when read and write callers differ.
 *  - Repository interface mirrors CRUD + any custom query the service needs.
 *    Do NOT leak Mongoose types (Document, ObjectId) into the interface.
 *  - Mapper interface defines doc → DTO and input → partial-doc transforms.
 *  - JSDoc every public method — the interface IS the documentation.
 */

import type { Types } from 'mongoose';

// ───────────────────────────────────────────────────────────────────────────
// Domain types (move to ../types/index.ts if shared across modules)
// ───────────────────────────────────────────────────────────────────────────

/** Public DTO — what leaves the server */
export interface <Module>DTO {
  id: string;
  // ...domain fields
  createdAt: string; // ISO string, never Date
  updatedAt: string;
}

/** Create payload — what comes in from the client */
export interface <Module>CreateInput {
  // ...only fields the client provides
}

/** Update payload — partial, usually omits immutable fields */
export type <Module>UpdateInput = Partial<<Module>CreateInput>;

/** Query filter — what the service translates into Mongo filters */
export interface <Module>Filter {
  year?: number;
  month?: number;
  // ...additional filters
}

/** Internal Mongoose shape — keep private to repository + mapper */
export interface I<Module> {
  _id: Types.ObjectId | string;
  userEmail: string;
  // ...schema fields
  createdAt: Date;
  updatedAt: Date;
}

// ───────────────────────────────────────────────────────────────────────────
// Repository contract — data access only
// ───────────────────────────────────────────────────────────────────────────

export interface I<Module>Repository {
  /** Return all docs matching a pre-built Mongo filter. */
  findAll(filter: Record<string, unknown>): Promise<I<Module>[]>;

  /** Return a single doc scoped to the owning user, or null if not found. */
  findById(id: string, userEmail: string): Promise<I<Module> | null>;

  /** Insert a new doc. Caller is responsible for setting `userEmail`. */
  create(data: Partial<I<Module>>): Promise<I<Module>>;

  /** Update a user-owned doc. Returns the updated doc or null. */
  update(id: string, userEmail: string, data: Partial<I<Module>>): Promise<I<Module> | null>;

  /** Delete a user-owned doc. Returns the deleted doc or null. */
  delete(id: string, userEmail: string): Promise<I<Module> | null>;
}

// ───────────────────────────────────────────────────────────────────────────
// Service contracts — ISP split
// ───────────────────────────────────────────────────────────────────────────

/** Read-side operations — used by list/detail controllers, analytics, exports. */
export interface I<Module>ReadService {
  getAll(filter: <Module>Filter, userEmail: string): Promise<<Module>DTO[]>;
  getById(id: string, userEmail: string): Promise<<Module>DTO>;
}

/** Write-side operations — used by mutation controllers only. */
export interface I<Module>WriteService {
  create(input: <Module>CreateInput, userEmail: string): Promise<<Module>DTO>;
  update(id: string, input: <Module>UpdateInput, userEmail: string): Promise<<Module>DTO>;
  delete(id: string, userEmail: string): Promise<<Module>DTO>;
}

/** Combined alias for controllers that need both. */
export type I<Module>Service = I<Module>ReadService & I<Module>WriteService;

// ───────────────────────────────────────────────────────────────────────────
// Mapper contract — pure, no I/O
// ───────────────────────────────────────────────────────────────────────────

export interface I<Module>Mapper {
  toDTO(doc: I<Module>): <Module>DTO;
  toDTOList(docs: I<Module>[]): <Module>DTO[];
  toCreateData(input: <Module>CreateInput, userEmail: string): Partial<I<Module>>;
  toUpdateData(input: <Module>UpdateInput): Partial<I<Module>>;
}
