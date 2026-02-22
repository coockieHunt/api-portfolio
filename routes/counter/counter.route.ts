import express, { Router } from 'express';
import CounterController from './counter.controller.ts';
import { CounterValidator } from './counter.validator.ts';
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { authenticateToken } from '../../middlewares/authenticateToken.middlewar.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const CounterRoute: Router = express.Router({ mergeParams: true });

/**
 * GET /:name - Get counter value
 * Retrieve the current value of the specified counter
 *  @param req Express Request object
 *  @param res Express Response object
 */
CounterRoute.get('/:name',
    rateLimiter,
    CounterValidator.getCounter,
    validateRequest,
    asyncHandler(CounterController.getCounter)
);

/**
 * POST /:name/increment - Increment counter
 * Increment the specified counter by 1
 *  @param req Express Request object
 *  @param res Express Response object
 */
CounterRoute.post('/:name/increment',
    rateLimiter,
    CounterValidator.incrementCounter,
    validateRequest,
    asyncHandler(CounterController.incrementCounter)
);

/**
 * POST /:name/decrement - Decrement counter
 * Decrement the specified counter by 1
 *  @param req Express Request object
 *  @param res Express Response object
 */
CounterRoute.post('/:name/decrement',
    rateLimiter,
    authenticateToken,
    CounterValidator.decrementCounter,
    validateRequest,
    asyncHandler(CounterController.decrementCounter)
);

/**
 * DELETE /:name - Reset counter
 * Reset the specified counter to zero
 *  @param req Express Request object
 *  @param res Express Response object
 */
CounterRoute.delete('/:name',
    rateLimiter,
    authenticateToken,
    CounterValidator.resetCounter,
    validateRequest,
    asyncHandler(CounterController.resetCounter)
);

export default CounterRoute;
