import express, { Router } from 'express';
import type { Request, Response } from 'express';
import TagsController from './tags.controller.ts';
import { TagsValidator } from './tags.validator.ts';
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { authenticateToken,  HybridAuthenticateToken} from '../../middlewares/authenticateToken.middlewar.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const TagsRoute: Router = express.Router({ mergeParams: true });

/**
 * GET / - Get all tags
 * Retrieves all tags.
 * @param req Express Request object
 * @param res Express Response object
 */
TagsRoute.get('/',
	rateLimiter,
    HybridAuthenticateToken,
    TagsValidator.getAll,
    validateRequest,
	asyncHandler(TagsController.getAll),
	responseHandler
);

/**
 * GET /:slug - Get tag by slug
 * Retrieves a tag by its slug.
 * @param req Express Request object
 * @param res Express Response object
 */
TagsRoute.get('/:slug',
	rateLimiter,
    HybridAuthenticateToken,
	TagsValidator.getBySlug,
	validateRequest,
	asyncHandler(TagsController.getBySlug),
	responseHandler
);

/**
 * DELETE /:slug - Delete tag by slug
 * Deletes a tag by its slug.
 * @param req Express Request object
 * @param res Express Response object
 */
TagsRoute.delete('/:slug',
	rateLimiter,
	authenticateToken,
	TagsValidator.delete,
	validateRequest,
	asyncHandler(TagsController.delete),
	responseHandler
);

/**
 * POST / - Create a new tag
 * Creates a new tag.
 * @param req Express Request object
 * @param res Express Response object
 */
TagsRoute.post('/',
	rateLimiter,
	authenticateToken,
	TagsValidator.create,
	validateRequest,
	asyncHandler(TagsController.create),
	responseHandler
);

/**
 * PUT /:slug - Update tag by slug
 * Updates a tag by its slug.
 * @param req Express Request object
 * @param res Express Response object
 */
TagsRoute.put('/:slug',
	rateLimiter,
	authenticateToken,
	TagsValidator.update,
	validateRequest,
	asyncHandler(TagsController.update),
	responseHandler
);

export default TagsRoute;
