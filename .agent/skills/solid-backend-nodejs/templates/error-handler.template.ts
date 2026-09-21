/**
 * Global Error Handler Middleware
 *
 * Location: server/src/middleware/errorHandler.ts
 *
 * Mount LAST in the Express app:
 *   app.use(errorHandler);
 *
 * Responsibilities:
 *  - AppError subclasses → use their statusCode + message + details.
 *  - Any other Error → 500 with a generic message (never leak internals).
 *  - Always log at server side; never skip logging production errors.
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // Always log — even if we return a generic message to the client.
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  if (err.stack) console.error(err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};
