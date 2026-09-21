/**
 * <Module> Routes
 *
 * Location: server/src/routes/<modules>.ts
 *
 * SRP: routing ONLY.
 *  - Pattern: router.METHOD(path, validator?, asyncHandler(controller.action))
 *  - No business logic. No try/catch. No db calls.
 *  - Validators and auth run as middleware BEFORE the controller.
 */

import { Router } from 'express';
import { <module>Controller } from '../composition/container.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  validate<Module>Create,
  validate<Module>Update,
  validate<Module>Filter,
} from '../validators/<module>.validator.js';

const router = Router();

router.use(requireAuth);

router.get('/',        validate<Module>Filter, asyncHandler(<module>Controller.getAll));
router.get('/:id',                             asyncHandler(<module>Controller.getById));
router.post('/',       validate<Module>Create, asyncHandler(<module>Controller.create));
router.put('/:id',     validate<Module>Update, asyncHandler(<module>Controller.update));
router.delete('/:id',                          asyncHandler(<module>Controller.delete));

export default router;
