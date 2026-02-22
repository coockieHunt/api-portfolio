import express, { Router } from 'express';
import AuthorsController from './authors.controller.ts';
import { AuthorsValidator } from './authors.validator.ts';
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { authenticateToken } from '../../middlewares/authenticateToken.middlewar.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const AuthorsRoute: Router = express.Router({ mergeParams: true });

/**
 * GET / - Get all authors
 * Retrieves all authors
 * @param req Express Request object
 * @param res Express Response object
 */
AuthorsRoute.get(
    '/',
    rateLimiter,
    AuthorsValidator.getAll,
    validateRequest,
    asyncHandler(AuthorsController.getAll),
    responseHandler
);

/**
 * GET /:id - Get author by ID
 * Retrieves a specific author by their ID
 * @param req Express Request object
 * @param res Express Response object
 */
AuthorsRoute.get(
    '/:id',
    rateLimiter,
    AuthorsValidator.getById,
    validateRequest,
    asyncHandler(AuthorsController.getById),
    responseHandler
);

/**
 * POST / - Create a new author
 * Creates a new author (requires authentication)
 * @param req Express Request object
 * @param res Express Response object
 */
AuthorsRoute.post(
    '/',
    rateLimiter,
    authenticateToken,
    AuthorsValidator.create,
    validateRequest,
    asyncHandler(AuthorsController.create),
    responseHandler
);

/**
 * PUT /:id - Update an author
 * Updates an author by ID (requires authentication)
 * @param req Express Request object
 * @param res Express Response object
 */
AuthorsRoute.put(
    '/:id',
    rateLimiter,
    authenticateToken,
    AuthorsValidator.update,
    validateRequest,
    asyncHandler(AuthorsController.update),
    responseHandler
);

/**
 * DELETE /:id - Delete an author
 * Deletes an author by ID (requires authentication)
 * @param req Express Request object
 * @param res Express Response object
 */
AuthorsRoute.delete(
    '/:id',
    rateLimiter,
    authenticateToken,
    AuthorsValidator.delete,
    validateRequest,
    asyncHandler(AuthorsController.delete),
    responseHandler
);

export default AuthorsRoute;
