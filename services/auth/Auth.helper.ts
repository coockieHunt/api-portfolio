import { RedisClient } from '../../services/Redis.service.ts';
import { AUTHORIZED_REDIS_PREFIXES } from '../../constants/redis.constant.ts';
import { validateKey } from '../../utils/redis.helper.ts';

export class AuthHelper {
    static parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
        if (typeof value !== 'string') return defaultValue;
        return value.toLowerCase() === 'true';
    }

    static parseSameSite(
        value: string | undefined,
        defaultValue: 'lax' | 'strict' | 'none'
    ): 'lax' | 'strict' | 'none' {
        if (!value) return defaultValue;
        const normalized = value.toLowerCase();
        if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
            return normalized;
        }
        return defaultValue;
    }

    static buildAuthCookieOptions(maxAge?: number) {
        const isProduction = process.env.NODE_ENV === 'production';
        const secure = this.parseBoolean(process.env.AUTH_COOKIE_SECURE, isProduction);
        const sameSite = this.parseSameSite(
            process.env.AUTH_COOKIE_SAMESITE,
            isProduction ? 'strict' : 'lax'
        );
        const domain = process.env.AUTH_COOKIE_DOMAIN || undefined;
        const path = process.env.AUTH_COOKIE_PATH || '/';

        return {
            httpOnly: true,
            secure,
            sameSite,
            domain,
            path,
            ...(typeof maxAge === 'number' ? { maxAge } : {})
        } as const;
    }

    /**
     * Generates the Redis key for a given token
     * @param token - The authentication token
     * @returns The prefixed Redis key for token storage
     */
    static getTokenKey(token: string): string {
        return `${AUTHORIZED_REDIS_PREFIXES.AUTH_TOKEN}${token}`;
    }

    /**
     * Checks if Redis client is connected
     * @returns boolean
     */
    static isRedisReady(): boolean {
        return !!RedisClient && RedisClient.isReady;
    }

    /**
     * Gets token TTL from environment
     * @returns TTL in seconds
     */
    static getTokenTTL(): number {
        return Number(process.env.TOKEN_TTL_REVOCATION) || 86400;
    }

    /**
     * Validates and gets Redis key for token
     * @param token - The token
     * @returns The validated Redis key
     */
    static getValidatedTokenKey(token: string): string {
        const key = this.getTokenKey(token);
        validateKey(key);
        return key;
    }

    /**
     * Sets revoked token in Redis
     * @param key - The Redis key
     * @param ttl - Time to live in seconds
     */
    static async setRevokedToken(key: string, ttl: number): Promise<void> {
        await RedisClient.set(key, 'revoked', { EX: ttl });
    }

    /**
     * Gets revoked token from Redis
     * @param key - The Redis key
     * @returns The value or null
     */
    static async getRevokedToken(key: string): Promise<string | null> {
        return await RedisClient.get(key);
    }
}
