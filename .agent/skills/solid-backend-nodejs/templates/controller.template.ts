/**
 * <Module> Controller
 *
 * Location: server/src/controllers/<module>.controller.ts
 *
 * SRP: HTTP orchestration only.
 *  - Parse request → extract typed values.
 *  - Call service.
 *  - Format ApiResponse<T> → send.
 *  - NEVER contain business logic. NEVER call Mongoose.
 *
 * DIP: depends on I<Module>Service interface, not the concrete class.
 *
 * Error handling: controllers DO NOT try/catch. The asyncHandler middleware
 * catches rejected promises and forwards to errorHandler.
 */

import type { Request, Response } from 'express';
import type { I<Module>Service } from '../interfaces/<module>.interfaces.js';
import type { ApiResponse } from '../types/index.js';

// Request with authenticated user attached by authMiddleware.
interface AuthRequest extends Request {
  user: { email: string };
}

export class <Module>Controller {
  constructor(private readonly service: I<Module>Service) {}

  /** GET /api/<modules> */
  getAll = async (req: Request, res: Response): Promise<void> => {
    const { email } = (req as AuthRequest).user;
    // req.query has been replaced by the validator with parsed types.
    const items = await this.service.getAll(req.query as never, email);
    const body: ApiResponse<typeof items> = { success: true, data: items };
    res.json(body);
  };

  /** GET /api/<modules>/:id */
  getById = async (req: Request, res: Response): Promise<void> => {
    const { email } = (req as AuthRequest).user;
    const item = await this.service.getById(req.params.id, email);
    res.json({ success: true, data: item } satisfies ApiResponse<typeof item>);
  };

  /** POST /api/<modules> */
  create = async (req: Request, res: Response): Promise<void> => {
    const { email } = (req as AuthRequest).user;
    const item = await this.service.create(req.body, email);
    res.status(201).json({ success: true, data: item } satisfies ApiResponse<typeof item>);
  };

  /** PUT /api/<modules>/:id */
  update = async (req: Request, res: Response): Promise<void> => {
    const { email } = (req as AuthRequest).user;
    const item = await this.service.update(req.params.id, req.body, email);
    res.json({ success: true, data: item } satisfies ApiResponse<typeof item>);
  };

  /** DELETE /api/<modules>/:id */
  delete = async (req: Request, res: Response): Promise<void> => {
    const { email } = (req as AuthRequest).user;
    const item = await this.service.delete(req.params.id, email);
    res.json({ success: true, data: item } satisfies ApiResponse<typeof item>);
  };
}
