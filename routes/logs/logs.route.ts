import express, { Router } from 'express';

import { LogsValidator } from './logs.validator.ts';
import LogsController from './logs.controller.ts';

import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';
import { authenticateToken} from '../../middlewares/authenticateToken.middlewar.ts';


const LogsRoute: Router = express.Router({ mergeParams: true });

LogsRoute.get(
    '/fallback/list',
    authenticateToken,
    rateLimiter,
    validateRequest,
    LogsValidator.GetFallBackList,
    asyncHandler(new LogsController().GetFallBackList),
    responseHandler
);

LogsRoute.get(
    '/fallback/view/',
    authenticateToken,
    rateLimiter,
    validateRequest,
    LogsValidator.GetFallBackList,
    asyncHandler(new LogsController().GetInfoByFilename),
    responseHandler
);


export default LogsRoute;