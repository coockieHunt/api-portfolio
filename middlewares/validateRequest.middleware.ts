import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logConsole, writeToLog } from './log.middlewar.ts';

/**
 * Request validation middleware
 * 
 * Checks for validation errors from express-validator.
 * Returns 400 with detailed error messages if validation fails.
 * Logs validation failures for monitoring.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorArray = errors.array();

        const errorDetails = errorArray.map(err => `${(err as any).path || (err as any).param || 'field'}: ${err.msg}`).join(', ');
        logConsole(req.method, req.originalUrl, 'FAIL', 'Validation Error', { details: errorDetails });
        writeToLog(`Validation Error: ${JSON.stringify(errorArray)}`, 'validation_error');

        return res.error(errorDetails, 400, errorArray);
    }
    next();
};