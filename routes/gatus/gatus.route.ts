import express, { Router } from 'express';
import GatusController from './gatus.controller.ts';
import { GatusValidator } from './gatus.validator.ts';

import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const GatusRoute: Router = express.Router({ mergeParams: true });

/**
 * GET /endpoints - Get all Gatus endpoints status
 * Retrieve all monitored endpoints status from Gatus
 * @param req Express Request object
 * @param res Express Response object
 */
GatusRoute.get('/endpoints',
    rateLimiter,
    GatusValidator.getEndpoints,
    validateRequest,
    asyncHandler(GatusController.getEndpoints),
    responseHandler
);

export default GatusRoute;
