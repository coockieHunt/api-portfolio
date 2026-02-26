import express, { Router } from 'express';

import { LogsValidator } from './logs.validator.ts';
import LogsController from './logs.controller.ts';

import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';
import { authenticateToken} from '../../middlewares/authenticateToken.middlewar.ts';
import { allowOnlyFromIPs } from '../../middlewares/whiteList.middlewar.ts';


const LogsRoute: Router = express.Router({ mergeParams: true });

LogsRoute.get(
    '/fallback/list',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    validateRequest,
    LogsValidator.GetFallBackList,
    asyncHandler(new LogsController().GetFallBackList),
    responseHandler
);

LogsRoute.get(
    '/fallback/view/',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    validateRequest,
    LogsValidator.GetFallBackView,
    asyncHandler(new LogsController().GetInfoByFilename),
    responseHandler
);

LogsRoute.post(
    '/fallback/force',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    validateRequest,
    LogsValidator.PostFallBackForce,
    asyncHandler(new LogsController().PostFallBackForce),
    responseHandler
)

export default LogsRoute;