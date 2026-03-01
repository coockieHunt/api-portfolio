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
    LogsValidator.GetFallBackList,
    validateRequest,
    asyncHandler(new LogsController().GetFallBackList),
    responseHandler
);

LogsRoute.get(
    '/fallback/view/',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    LogsValidator.GetFallBackView,
    validateRequest,
    asyncHandler(new LogsController().GetInfoByFilename),
    responseHandler
);

LogsRoute.post(
    '/fallback/force',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    LogsValidator.PostFallBackForce,
    validateRequest,
    asyncHandler(new LogsController().PostFallBackForce),
    responseHandler
)

LogsRoute.get(
    '/systeme/list',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    LogsValidator.GetLogsList,
    validateRequest,
    asyncHandler(new LogsController().GetLogsList),
    responseHandler
);

export default LogsRoute;