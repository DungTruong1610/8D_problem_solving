/**
 * <Module> Validator (Zod)
 *
 * Location: server/src/validators/<module>.validator.ts
 *
 * SRP: input validation only. Shape + type + basic constraints.
 *  - Business rule validation (e.g., "user owns this record") stays in Service.
 *  - Validators run as Express middleware BEFORE the controller.
 *  - On failure, throw ValidationError — errorHandler formats the response.
 *
 * Why Zod: types are inferred from schemas, eliminating duplication between
 * runtime validation and TypeScript types.
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors/ValidationError.js';

// ───────────────────────── Schemas ─────────────────────────

export const <module>CreateSchema = z.object({
  // Example:
  // date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date'),
  // instrument: z.string().min(1).max(20),
  // side: z.enum(['long', 'short']),
  // pnl: z.number().finite(),
});

export const <module>UpdateSchema = <module>CreateSchema.partial();

export const <module>FilterSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  // ...
});

// Inferred TS types — use these across the codebase.
export type <Module>CreateInput = z.infer<typeof <module>CreateSchema>;
export type <Module>UpdateInput = z.infer<typeof <module>UpdateSchema>;
export type <Module>Filter    = z.infer<typeof <module>FilterSchema>;

// ───────────────────────── Middleware ─────────────────────────

const run = <T extends z.ZodTypeAny>(schema: T, source: 'body' | 'query' | 'params') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new ValidationError('Invalid input', result.error.flatten()));
      return;
    }
    // Replace the raw input with the parsed + typed version.
    (req as Record<string, unknown>)[source] = result.data;
    next();
  };

export const validate<Module>Create = run(<module>CreateSchema, 'body');
export const validate<Module>Update = run(<module>UpdateSchema, 'body');
export const validate<Module>Filter = run(<module>FilterSchema, 'query');
