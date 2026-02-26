import express, { Router } from 'express';
import BlogController from './blog.controller.ts';
import { BlogValidator } from './blog.validator.ts';

// middlewares
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { authenticateToken, HybridAuthenticateToken } from '../../middlewares/authenticateToken.middlewar.ts';
import { allowOnlyFromIPs } from '../../middlewares/whiteList.middlewar.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const BlogRoute: Router = express.Router({ mergeParams: true });

/**
 * GET /all - Get all blog posts with pagination
 * Retrieve all blog posts with pagination
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.get('/all', 
    rateLimiter,
    HybridAuthenticateToken,
    BlogValidator.getAll,
    validateRequest,
    asyncHandler(BlogController.getAll),
    responseHandler
);

/**
 * GET /offset - Get blog posts with offset-based pagination
 * Retrieve blog posts using offset-based pagination with optional filters
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.get('/offset', 
    rateLimiter,
    BlogValidator.getOffset,
    validateRequest,
    asyncHandler(BlogController.getOffset),
responseHandler);

/**
 * GET /:slug - Get blog post by slug
 * Retrieve a blog post using its slug
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.get('/:slug', 
    rateLimiter,
    BlogValidator.getBySlug,
    validateRequest,
    HybridAuthenticateToken,
    asyncHandler(BlogController.getBySlug),
responseHandler);

/**
 * POST /new - Create a new blog post
 * Create a new blog post with the provided details
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.post('/new',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    BlogValidator.create,
    validateRequest,
    asyncHandler(BlogController.create),
responseHandler);

/**
 * PUT /edit/update/:slug - Update blog post by slug
 * Update the details of a blog post
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.put('/edit/update/:slug',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    BlogValidator.update,
    validateRequest,
    asyncHandler(BlogController.update),
responseHandler);

/**
 * PUT /edit/publish/:slug - Publish or unpublish blog post
 * Update the published status of a blog post
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.put('/edit/publish/:slug',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    BlogValidator.updatePublish,
    validateRequest,
    asyncHandler(BlogController.updatePublish),
responseHandler);

/**
 * PUT /edit/indexed/:slug - Set indexed status for blog post
 * Update the indexed status of a blog post
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.put('/edit/indexed/:slug',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    BlogValidator.updateIndexed,
    validateRequest,
    asyncHandler(BlogController.updateIndexed),
responseHandler);

/**
 * DELETE /:slug - Delete blog post by slug
 * Delete a blog post by its slug
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.delete('/:slug',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    BlogValidator.delete,
    validateRequest,
    asyncHandler(BlogController.delete),
responseHandler);

/**
 * DELETE /cache/delete/:slug - Delete blog post cache by slug
 * Delete the cached version of a blog post by its slug
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.delete('/cache/delete/:slug',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    BlogValidator.delete,
    validateRequest,
    asyncHandler(BlogController.CacheClear),
responseHandler);

/** 
* DELETE /cache/clear/ - Clear all blog post cache
* Delete the cached version of all blog posts
* @param req Express Request object
* @param res Express Response object
*/
BlogRoute.delete('/cache/clear/',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    asyncHandler(BlogController.CacheClearAll),
responseHandler);

/** GET /version/:slug - Get blog post version by slug
 * Retrieve a specific version of a blog post using its slug
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.get('/version/:slug',
    rateLimiter,
    BlogValidator.getBySlug,
    validateRequest,
    asyncHandler(BlogController.getPostVersion),
responseHandler);

/** PUT /version/:slug/update - Update blog post version by slug
 * Update a specific version of a blog post using its slug
 *  @param req Express Request object
 *  @param res Express Response object
 */
BlogRoute.put('/version/:slug/update',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    BlogValidator.getBySlug,
    validateRequest,
    asyncHandler(BlogController.updatePostVersion),
responseHandler);

export default BlogRoute;