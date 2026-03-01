//express
import express, { Router } from 'express';

//controllers
import AuthController from './auth.controller.ts';

//validators
import { AuthValidator } from './auth.validator.ts';

// middlewares
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { authenticateToken } from '../../middlewares/authenticateToken.middlewar.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const AuthRoute: Router = express.Router({ mergeParams: true });

/**
 * POST /login - User login
 * Authenticate user and provide a JWT token
 *  @param req Express Request object
 *  @param res Express Response object
 */
AuthRoute.post('/login', 
    rateLimiter,
    AuthValidator.login,
    validateRequest,
    asyncHandler(AuthController.login),
    responseHandler
);

/**
 * GET /me - Check authentication status
 * Verify if the user is authenticated by checking the JWT cookie
 *  @param req Express Request object
 *  @param res Express Response object
 */
AuthRoute.get('/me',
    rateLimiter,
    authenticateToken,
    asyncHandler(AuthController.me),
    responseHandler
);

/**
 * POST /logout - User logout
 * Revoke the JWT token to log out the user
 *  @param req Express Request object
 *  @param res Express Response object
 */
AuthRoute.post('/logout', 
	rateLimiter,
    authenticateToken,
    AuthValidator.logout,
    asyncHandler(AuthController.logout),
    responseHandler
);

export default AuthRoute;