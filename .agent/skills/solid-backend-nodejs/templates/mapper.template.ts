/**
 * <Module> Mapper
 *
 * Location: server/src/mappers/<module>.mapper.ts
 *
 * SRP: data-shape transformation only.
 *  - doc → DTO (strip Mongo internals, convert Date → ISO string)
 *  - CreateInput → Partial<I<Module>> (service calls this before repo.create)
 *  - UpdateInput → Partial<I<Module>> (service calls this before repo.update)
 *
 * Pure functions only. No I/O. No logging. No side-effects.
 * Easy to unit-test in isolation.
 */

import type {
  I<Module>Mapper,
  I<Module>,
  <Module>DTO,
  <Module>CreateInput,
  <Module>UpdateInput,
} from '../interfaces/<module>.interfaces.js';

export class <Module>Mapper implements I<Module>Mapper {
  toDTO(doc: I<Module>): <Module>DTO {
    return {
      id: String(doc._id),
      // ...map domain fields 1:1 or transform as needed
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  toDTOList(docs: I<Module>[]): <Module>DTO[] {
    return docs.map((doc) => this.toDTO(doc));
  }

  toCreateData(input: <Module>CreateInput, userEmail: string): Partial<I<Module>> {
    // Never mutate `input`. Return a fresh object.
    return {
      ...input,
      userEmail,
    } as Partial<I<Module>>;
  }

  toUpdateData(input: <Module>UpdateInput): Partial<I<Module>> {
    // Strip undefined keys so $set doesn't overwrite with null.
    const out: Partial<I<Module>> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
    return out;
  }
}
