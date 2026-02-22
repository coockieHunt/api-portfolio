import type { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
import { match } from 'path-to-regexp'; 
import { consola } from "consola";

import { RedisClient } from '../services/Redis.service.ts';
import { AuthService } from '../services/auth/Auth.service.ts';

import cfg from '../config/default.ts';

import { logConsole, writeToLog } from '../middlewares/log.middlewar.ts';

import { normalizeUrl } from '../utils/url.helper.ts';

import jwt from 'jsonwebtoken';

interface RouteConfig {
    match: {
        url: string;
        method?: string;
    };
    windowSeconds?: number;
    maxRequests?: number;
    adminBypass?: boolean;
}

interface RateConfig {
    enabled?: boolean;
    default?: {
        windowSeconds: number;
        maxRequests: number;
        adminBypass?: boolean;
    };
    routes?: Record<string, RouteConfig>;
}

interface LimitContext {
    key: string;
    windowSeconds: number;
    maxRequests: number;
    adminBypass: boolean;
}

const rateConfig: RateConfig | null = (() => {
    try {
        return (cfg.rateLimiter as RateConfig) || null;
    } catch (err) {
        consola.warn('RateLimiter: unable to read config.rateLimiter, falling back to env/defaults');
        return null;
    }
})();

try {
    const enabled = !(rateConfig && rateConfig.enabled === false);
    const defaultCfg = rateConfig?.default || { windowSeconds: 60, maxRequests: 5 };
    const routesList = rateConfig?.routes ? Object.keys(rateConfig.routes) : [];
    
    const statusLabel = enabled ? chalk.green('ACTIVE') : chalk.red('DISABLED');
    
    const formattedRoutes = routesList.reduce((acc, route, i) => {
        return acc + ((i > 0 && i % 4 === 0) ? ',\n  ' : (i > 0 ? ', ' : '')) + route;
    }, '');

    const routesDisplay = routesList.length > 0 
        ? chalk.magenta(formattedRoutes) 
        : chalk.italic.dim('none');

    consola.box({
        title: chalk.bold('🛡️  Rate Limiter Configuration'),
        message: [
            `${chalk.bold('Status:')}  ${statusLabel}`,
            `${chalk.bold('Default:')} ${chalk.yellow(defaultCfg.maxRequests)} req / ${chalk.yellow(defaultCfg.windowSeconds + 's')}`,
            `${chalk.bold('Routes:')}  ${routesDisplay}`
        ].join('\n'),
        style: {
            borderColor: enabled ? "green" : "red",
            borderStyle: "round",
        }
    });

    const logMsg = `RateLimiter: enabled=${enabled}, default=${defaultCfg.maxRequests}/${defaultCfg.windowSeconds}s, route=${routesList.join(',') || 'none'}`;
    writeToLog(logMsg, 'rateLimiter');
} catch (e) {
    consola.success('RateLimiter loaded with default settings.');
}

/**
    * Determines rate limiting parameters for the incoming request
    * based on the rate limiting configuration.
    * 
    * Matches request URL and method against configured routes.
    * Falls back to default settings if no specific route matches.
    * 
    * @param req - Express request object
    * @returns LimitContext containing rate limiting parameters
 */
function getLimitsContext(req: Request): LimitContext {
    const defaults = {
        windowSeconds: parseInt(process.env.RATE_WINDOW_SECONDS || '60', 10),
        maxRequests: parseInt(process.env.RATE_MAX_REQUESTS || '5', 10),
        adminBypass: false,
    };

    const urlWithoutQuery = (req.originalUrl || req.url).split('?')[0];
    const currentUrl = normalizeUrl(urlWithoutQuery);
    const currentMethod = (req.method || 'GET').toUpperCase();

    if (rateConfig && rateConfig.enabled !== false && rateConfig.routes) {
        for (const [key, routeCfg] of Object.entries(rateConfig.routes)) {
            if (routeCfg.match) {
                const configUrl = normalizeUrl(routeCfg.match.url);
                const configMethod = (routeCfg.match.method || 'GET').toUpperCase();

                if (configMethod !== currentMethod) continue;

                try {
                    const matcher = match(configUrl, { decode: decodeURIComponent });
                    const isMatch = matcher(currentUrl);

                    if (isMatch) {
                        return {
                            key: key,
                            windowSeconds: Number(routeCfg.windowSeconds ?? rateConfig.default?.windowSeconds ?? defaults.windowSeconds),
                            maxRequests: Number(routeCfg.maxRequests ?? rateConfig.default?.maxRequests ?? defaults.maxRequests),
                            adminBypass: Boolean(routeCfg.adminBypass ?? rateConfig.default?.adminBypass ?? defaults.adminBypass)
                        };
                    }
                } catch (err) {
                    consola.error(`RateLimiter: Pattern invalide pour la route [${key}]: ${configUrl}`);
                }
            }
        }
    }

    const fallbackKey = `default:${currentUrl}`;
    
    if (rateConfig && rateConfig.default) {
        return {
            key: fallbackKey,
            windowSeconds: Number(rateConfig.default.windowSeconds ?? defaults.windowSeconds),
            maxRequests: Number(rateConfig.default.maxRequests ?? defaults.maxRequests),
            adminBypass: Boolean(rateConfig.default.adminBypass ?? false),
        };
    }

    return { key: fallbackKey, ...defaults, adminBypass: false };
}

/** Rate Limiting Middleware
 * 
 * Enforces rate limits on incoming requests based on configuration.
 * Uses Redis to track request counts per IP and route within time windows.
 * Supports admin bypass for certain routes.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Promise resolving to void or a 429 response if rate limit exceeded
 */
export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
        const redis = RedisClient;
        const logger = consola.withTag('RateLimit');
        
        if (!redis || !redis.isReady) {
            logger.warn('Redis not connected, skipping.');
            return next();
        }

        const { key: routeKey, windowSeconds, maxRequests, adminBypass } = getLimitsContext(req);

        if (adminBypass) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                try {
                    const isRevoked = await AuthService.isTokenRevoked(token);

                    if (!isRevoked) {
                        const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string);
                        logger.info(chalk.cyan('Admin bypass activated for user'), (user as any).name);
                        return next(); 
                    }

                } catch (error) {}
            }
        }
        
        const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString();
        const redisKey = `rate:${routeKey}:${ip}`;

        const current = await redis.incr(redisKey);
        
        const isDefault = routeKey.startsWith('default:');
        const status = isDefault ? chalk.red.bold('unRegister') : chalk.green.bold('register');
        
        const methodColors: Record<string, any> = {
            'GET': chalk.green, 'POST': chalk.yellow, 'DELETE': chalk.red, 'PUT': chalk.blue
        };
        const styledMethod = (methodColors[req.method] || chalk.white)(req.method);

        logger.log([
            status,
            `${chalk.gray('name=')}${chalk.cyan(routeKey)}`,
            `${chalk.gray('method=')}${styledMethod}`,
            `${chalk.gray('count=')}${chalk.white(current)}/${chalk.white(maxRequests)}`,
            chalk.yellow('→'),
            chalk.gray(`window=${windowSeconds}s`)
        ].join(' '));

        writeToLog(`[RateLimit] ${isDefault ? 'unRegister' : 'register'} name=${routeKey} method=${req.method} count=${current}/${maxRequests}`, 'rateLimiter');

        if (current === 1) {await redis.expire(redisKey, windowSeconds);}

        if (current > maxRequests) {
            const ttl = await redis.ttl(redisKey);
            logConsole('RateLimit', req.originalUrl || req.url, 'FAIL', `Rate limit exceeded for IP {ip}, retry after {ttl}s`, { ip, ttl });
            writeToLog(`[RateLimit] Rate limit exceeded for IP ${ip} cooldown ${ttl}`, 'rateLimiter');
            return res.status(429).json({ 
                success: false, 
                message: 'Too many requests, please retry later.', 
                retryAfter: ttl 
            });
        }

        const remaining = Math.max(0, maxRequests - current);
        res.set('X-RateLimit-Limit', String(maxRequests));
        res.set('X-RateLimit-Remaining', String(remaining));
        
        return next();
    } catch (err: any) {
        consola.error('RateLimiter error:', err);
        return next();
    }
}

export default rateLimiter;