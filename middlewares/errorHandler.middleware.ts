import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.ts';
import { logConsole, writeToLog } from './log.middlewar.ts';

/**
 * Global Error Handler Middleware
 * 
 * Catches all errors from routes and services.
 * Standardizes error responses and logs errors appropriately.
 * 
 * @param err - The error thrown
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (unused but required for error middleware)
 */
export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const method = req.method;
    const path = req.originalUrl || req.path;

    // Handle custom AppError instances
    if (err instanceof AppError) {
        logConsole(method, path, 'WARN', err.message, { statusCode: err.statusCode });
        writeToLog(`AppError: ${err.message} [${err.statusCode}]`, 'validation_error');

        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            details: process.env.NODE_ENV === 'development' ? err.details : undefined,
            timestamp: new Date().toISOString()
        });
    }

    // Handle regular errors
    const statusCode = (err as any).statusCode || 500;
    const message = err.message || 'Internal Server Error';

    logConsole(method, path, 'FAIL', message, { statusCode });
    writeToLog(`Error: ${message}`, 'validation_error');

    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
    });
};

/**
 * Async Route Wrapper
 * 
 * Wraps async route handlers to catch errors and pass them to the error handler.
 * 
 * @param fn - The async route handler function
 * @returns Wrapped function that catches errors
 */
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
