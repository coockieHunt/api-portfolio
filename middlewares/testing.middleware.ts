import type { Request, Response, NextFunction } from 'express';
import config from '../config/default.ts';
import chalk from 'chalk';

/**
 * Testing middleware for simulating errors and latency
 * 
 * Enables testing of error handling and performance under delays.
 * Can simulate server errors (500) or artificial latency.
 * Controlled via config.fallback settings.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const TestingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const { latency: latencyEnabled, delayLatency, sendError: sendErrorEnabled, errorIn } = config.fallback;

    const logMessage = (msg: string) => {
        console.log(chalk.red(`[Testing Middleware]`), '→', msg);
    };

    //simulater 500
    if (sendErrorEnabled) {
        logMessage(`Activating error response in ${errorIn}ms.`);
        
        setTimeout(() => {
            logMessage("Sending simulated error response now.");
            res.status(500).json({ message: 'Simulated server error for testing.' });
        }, errorIn || 0);
        
        return;
    }

    //simulate latency
    if (latencyEnabled) {
        const delay = delayLatency || 0;
        logMessage(`Simulating latency of ${delay}ms.`);
        
        setTimeout(() => {
            logMessage(`Finished waiting ${delay}ms. Continuing request.`);
            next();
        }, delay);
        
        return; 
    }

    next();
};