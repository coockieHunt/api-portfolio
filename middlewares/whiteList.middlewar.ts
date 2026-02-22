// request
import type { Request, Response, NextFunction } from 'express';

// config
import config from '../config/default.ts';

// log
import { logConsole, writeToLog } from './log.middlewar.ts';

const allowedIPs = config.allowedIPs;

/**
 * Normalizes IP addresses for consistent comparison
 * 
 * Removes IPv6 prefix (::ffff:) and converts localhost variants.
 * Ensures IPv4 and IPv6 addresses are comparable.
 * 
 * @param ip - The IP address to normalize
 * @returns Normalized IP address string
 * @private
 */
const normalizeIP = (ip: string): string => {
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    if (ip === '::1') {
        return '127.0.0.1';
    }
    return ip;
};

/**
 * Converts IPv4 address string to 32-bit integer
 * @param ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns 32-bit integer representation
 */
const ipToInt = (ip: string): number => {
    return ip.split('.')
        .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

/**
 * Checks if an IP address is within a CIDR range
 * @param ip - IP address to check
 * @param cidr - CIDR notation (e.g., "192.168.0.0/24")
 * @returns true if IP is within the CIDR range
 */
const isIPInCIDR = (ip: string, cidr: string): boolean => {
    try {
        const [range, bits] = cidr.split('/');
        if (!range || !bits) return false;

        const rangeInt = ipToInt(range);
        const ipInt = ipToInt(ip);
        const mask = -1 << (32 - parseInt(bits, 10));

        return (ipInt & mask) === (rangeInt & mask);
    } catch {
        return false;
    }
};

/**
 * Checks if an IP address is in the whitelist
 * Supports both individual IPs and CIDR notation
 * @param ip - IP address to check
 * @returns true if IP is whitelisted
 */
const isIPWhitelisted = (ip: string): boolean => {
    return allowedIPs.some((allowedIP: string) => {
        if (allowedIP.includes('/')) {
            // CIDR notation
            return isIPInCIDR(ip, allowedIP);
        } else {
            // Exact match
            return normalizeIP(allowedIP) === ip;
        }
    });
};

/**
 * IP whitelist middleware
 * 
 * Restricts access to requests from whitelisted IP addresses only.
 * Returns 403 Forbidden for non-whitelisted IPs.
 * Supports both individual IPs and CIDR notation (e.g., "192.168.0.0/16").
 * Configured via config.allowedIPs array.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const allowOnlyFromIPs = (req: Request, res: Response, next: NextFunction): void => {
    const clientIP: string = req.ip || 'unknown';
    const normalizedClientIP = normalizeIP(clientIP);

    if (isIPWhitelisted(normalizedClientIP)) {
        logConsole('MIDDLEWARE', 'whiteList', 'OK', `Access granted`, { ip: clientIP , normalize: normalizedClientIP });
        writeToLog(`Whitelist allow ip=${clientIP} (normalized: ${normalizedClientIP})`, 'whitelist');
        next();
    } else {
        logConsole('MIDDLEWARE', 'whiteList', 'FAIL', `Access denied`, { ip: clientIP, normalize: normalizedClientIP });
        writeToLog(`Whitelist deny ip=${clientIP} (normalized: ${normalizedClientIP})`, 'whitelist');
        
        res.status(403).json({ 
            success: false, 
            message: 'Access denied from this IP address.' 
        });
    }
};