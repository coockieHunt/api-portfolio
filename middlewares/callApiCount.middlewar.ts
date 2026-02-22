// request
import type { Request, Response, NextFunction } from 'express';

//redis
import { RedisClient, RedisService } from '../services/Redis.service.ts';
import { AUTHORIZED_REDIS_KEYS } from '../constants/redis.constant.ts';

/**
 * API call tracking middleware
 * 
 * Increments a global counter in Redis for each API request.
 * Non-blocking - errors are logged but don't prevent request processing.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const trackApiCall = (
    req: Request, 
    res: Response, 
    next: NextFunction
): void => {
    if (RedisClient?.isReady) {
        RedisService.incrementCounter(AUTHORIZED_REDIS_KEYS.GLOBAL_STATUS).catch(() => {});
    }
    next();
};