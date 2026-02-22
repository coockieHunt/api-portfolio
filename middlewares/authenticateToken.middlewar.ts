import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import chalk from 'chalk';
import { AuthService } from '../services/auth/Auth.service.ts';

interface TokenPayload {
    userId: number;
    iat?: number;
    exp?: number;
}

/**
 * Authentication middleware
 * 
 * Verifies JWT tokens from Authorization header and checks revocation status.
 * Blocks access if token is missing, invalid, expired, or revoked.
 * Attaches decoded user payload to request object on success.
 * 
 * @param req - Express request object
 * @param res - Express response object  
 * @param next - Express next function
 * @returns Promise resolving when authentication completes
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const path = req.originalUrl || req.path;
    const method = req.method;

    const prefix = chalk.cyan('[AUTH]');

    if (!token) {
        console.log(`${prefix} ${chalk.red('FAIL')} No token provided → ${chalk.yellow(method)} ${path}`);
        return res.error('No token provided', 401);
    }

    try {
        const isRevoked = await AuthService.isTokenRevoked(token);
        if (isRevoked) {
            console.log(`${prefix} ${chalk.bgRed.white(' REVOKED ')} Access denied → ${chalk.yellow(method)} ${path}`);
            return res.error('Token revoked, please login again', 401);
        }

        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, user) => {
            if (err) {
                console.log(`${prefix} ${chalk.red('ERROR')} Invalid/Expired token → ${chalk.yellow(method)} ${path}`);
                return res.error('Invalid or expired token', 403);
            }

            console.log(`${prefix} ${chalk.green('OK')} Token verified → ${chalk.white(method)} ${chalk.gray(path)}`);
            
            req.user = user as TokenPayload;
            next();
        });

    } catch (error) {
        console.log(`${prefix} ${chalk.magenta('CRITICAL')} Redis/Auth Error →`, error);
        return res.error('Internal server error', 500);
    }
}

/**
 * Hybrid Authentication middleware
 * 
 * Similar to authenticateToken but allows requests without tokens to proceed.
 * If a token is provided, it is verified and checked for revocation.
 * Attaches decoded user payload to request object if token is valid.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Promise resolving when authentication completes
 */
export const HybridAuthenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const path = req.originalUrl || req.path;
    const prefix = chalk.cyan('[AUTH-HYBRID]');

    if (!token) {return next();}//no token guest

    try {
        const isRevoked = await AuthService.isTokenRevoked(token);
        if (isRevoked) {return next();}//token revoked guest

        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, user) => {
            if (err) {
                console.log(`${prefix} ${chalk.yellow('WARN')} no token Guest Access → ${chalk.gray(path)}`);
                return next();//invalid token guest
            }

            console.log(`${prefix} ${chalk.green('OK')} token verified  ${chalk.gray(path)}`);
            req.user = user as TokenPayload;
            next();//token valid admin
        });
        
    } catch (error) {
        console.log(`${prefix} ${chalk.magenta('CRITICAL')} Redis/Auth Error →`, error);
        return next();//redis/auth error guest
    }
}