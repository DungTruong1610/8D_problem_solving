/**
 * <Module> Repository
 *
 * Location: server/src/repositories/<module>.repository.ts
 *
 * SRP: data access only. No business rules. No req/res. No DTO transforms.
 * LSP: mirror the I<Module>Repository contract exactly.
 *
 * Conventions:
 *  - Always scope by `userEmail` for user-owned resources.
 *  - Use `.lean()` for read queries — service consumes plain objects, not
 *    Mongoose Documents. Keeps memory low and serializes cleanly.
 *  - Return `null` (not throw) when not-found. Service decides how to react.
 *  - Never expose Mongoose filter syntax to callers — accept a pre-built
 *    filter object and just pass it through.
 */

import { <Module>, type I<Module> } from '../models/<Module>.js';
import type { I<Module>Repository } from '../interfaces/<module>.interfaces.js';

export class <Module>Repository implements I<Module>Repository {
  async findAll(filter: Record<string, unknown>): Promise<I<Module>[]> {
    return <Module>.find(filter).sort({ createdAt: -1 }).lean<I<Module>[]>();
  }

  async findById(id: string, userEmail: string): Promise<I<Module> | null> {
    return <Module>.findOne({ _id: id, userEmail }).lean<I<Module> | null>();
  }

  async create(data: Partial<I<Module>>): Promise<I<Module>> {
    const doc = new <Module>(data);
    await doc.save();
    return doc.toObject() as I<Module>;
  }

  async update(
    id: string,
    userEmail: string,
    data: Partial<I<Module>>,
  ): Promise<I<Module> | null> {
    return <Module>.findOneAndUpdate(
      { _id: id, userEmail },
      { $set: data },
      { new: true, runValidators: true },
    ).lean<I<Module> | null>();
  }

  async delete(id: string, userEmail: string): Promise<I<Module> | null> {
    return <Module>.findOneAndDelete({ _id: id, userEmail }).lean<I<Module> | null>();
  }

  // ───── Add domain-specific queries here ─────
  // Example:
  // async findWithImages(userEmail: string): Promise<I<Module>[]> {
  //   return <Module>.find({ userEmail, 'images.0': { $exists: true } })
  //     .select('_id date instrument side pnl images')
  //     .sort({ date: -1 })
  //     .lean<I<Module>[]>();
  // }
}
