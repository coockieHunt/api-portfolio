import express, { Router } from 'express';
import GuestBookController from './guestbook.controller.ts';
import { GuestBookValidator } from './guestbook.validator.ts';
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { authenticateToken,  HybridAuthenticateToken} from '../../middlewares/authenticateToken.middlewar.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const GuestBookRoute: Router = express.Router({ mergeParams: true });

/**
 * GET / - Retrieve guestbook entries with pagination
 * read the guestbook entries.
 *  @param req Express Request object
 *  @param res Express Response object
 */
GuestBookRoute.get('/',
	rateLimiter,
	HybridAuthenticateToken,
	GuestBookValidator.getAll,
	validateRequest,
	asyncHandler(GuestBookController.getAll),
	responseHandler
);

/** PUT /authorize/:id - Authorize guestbook entry by ID
 * authorize a guestbook entry by ID
 *  @param req Express Request object
 *  @param res Express Response object
 */
GuestBookRoute.put('/authorize/:id',
    rateLimiter,
    authenticateToken,
    GuestBookValidator.authorize,
    validateRequest,
    asyncHandler(GuestBookController.authorize),
    responseHandler
);

GuestBookRoute.put('/unauthorize/:id',
    rateLimiter,
    authenticateToken,
    GuestBookValidator.unauthorize,
    validateRequest,
    asyncHandler(GuestBookController.unauthorize),
    responseHandler
);

/**
 * POST / - Add new entry
 * write entry to guestbook
 *  @param req Express Request object
 *  @param res Express Response object
 */
GuestBookRoute.post('/',
	rateLimiter,
	GuestBookValidator.create,
	validateRequest,
	asyncHandler(GuestBookController.create),
	responseHandler
);

/**
 * DELETE /:id - Delete guestbook entry by ID
 * delete the guestbook entry by ID
 *  @param req Express Request object
 *  @param res Express Response object
 */
GuestBookRoute.delete('/:id',
	rateLimiter,
	authenticateToken,
	GuestBookValidator.delete,
	validateRequest,
	asyncHandler(GuestBookController.delete),
	responseHandler
);

export default GuestBookRoute;
