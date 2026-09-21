/**
 * Typed Error Hierarchy
 *
 * Location: server/src/errors/*.ts  (one file per class)
 *
 * Rationale:
 *  - AppError carries statusCode + optional details → errorHandler maps 1:1.
 *  - Subclasses encode HTTP status into the type so callers can throw without
 *    remembering magic numbers.
 *  - Never throw plain Error — always use one of these. Otherwise errorHandler
 *    returns 500 + generic message.
 *
 * Split into one file per class. Keep this template as a single reference.
 */

// ╭─ errors/AppError.ts ─────────────────────────────────────────╮
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Preserve stack trace across subclasses.
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
// ╰──────────────────────────────────────────────────────────────╯


// ╭─ errors/NotFoundError.ts ────────────────────────────────────╮
// import { AppError } from './AppError.js';
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}
// ╰──────────────────────────────────────────────────────────────╯


// ╭─ errors/ValidationError.ts ──────────────────────────────────╮
// import { AppError } from './AppError.js';
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}
// ╰──────────────────────────────────────────────────────────────╯


// ╭─ errors/UnauthorizedError.ts ────────────────────────────────╮
// import { AppError } from './AppError.js';
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}
// ╰──────────────────────────────────────────────────────────────╯


// ╭─ errors/ForbiddenError.ts ───────────────────────────────────╮
// import { AppError } from './AppError.js';
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}
// ╰──────────────────────────────────────────────────────────────╯


// ╭─ errors/ConflictError.ts ────────────────────────────────────╮
// import { AppError } from './AppError.js';
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: unknown) {
    super(message, 409, details);
  }
}
// ╰──────────────────────────────────────────────────────────────╯
