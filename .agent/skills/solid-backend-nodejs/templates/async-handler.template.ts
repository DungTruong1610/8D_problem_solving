/**
 * asyncHandler Middleware
 *
 * Location: server/src/middleware/asyncHandler.ts
 *
 * Wraps async Express handlers so rejected promises forward to the global
 * errorHandler via next(err). Eliminates scattered try/catch blocks.
 *
 * Usage: router.get('/', asyncHandler(controller.getAll));
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> | void;

export const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
