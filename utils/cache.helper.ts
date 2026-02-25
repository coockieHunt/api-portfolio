//service
import { RedisClient } from '../services/Redis.service.ts';

//helpers
import { validateKey } from '../utils/redis.helper.ts';

//console
import chalk from 'chalk';

//type
interface CacheResponse<T> {
    cached: boolean;
    data: T | null;
}

/**
 * Generic helper to handle caching with Redis
 */
export async function withCache<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    ttl: number = 3600
): Promise<CacheResponse<T>> {
    validateKey(key);

    if (!RedisClient || !RedisClient.isReady) {return { cached: false, data: await fetchFn() };}

    try {
        const cached = await RedisClient.get(key);
        
        if (cached) {
            console.log(
                chalk.cyan(`[CACHE] `) + 
                chalk.green(`HIT   `) + 
                chalk.gray(`| Key: ${key}`)
            );
            
            return {
                cached: true,
                data: JSON.parse(cached) as T
            };
        }

        console.log(
            chalk.cyan(`[CACHE] `) + 
            chalk.yellow(`MISS  `) + 
            chalk.gray(`| Key: ${key} -> DB`)
        );

        const data = await fetchFn();

        if (data) {
            await RedisClient.set(key, JSON.stringify(data), { EX: ttl });
            console.log(
                chalk.cyan(`[CACHE] `) + 
                chalk.green(`SET   `) + 
                chalk.gray(`| Key: ${key} (${ttl}s)`)
            );
        }

        return {
            cached: false,
            data: data
        };

    } catch (error) {
        console.error(chalk.red(`[CACHE] ERROR | Key: ${key}`), error);
        return { cached: false, data: await fetchFn() }; 
    }
}

/**
 * Helper to get a value from a Redis Hash
 */
export async function hashGet(
    key: string,
    field: string
): Promise<string | undefined> {
    validateKey(key);

    if (!RedisClient || !RedisClient.isReady) {
        console.log(
            chalk.cyan(`[CACHE] `) + 
            chalk.red(`SKIP  `) + 
            chalk.gray(`| Redis not ready`)
        );
        return undefined;
    }

    try {
        const value = await RedisClient.hGet(key, field);
        
        if (value) {
            console.log(
                chalk.cyan(`[CACHE] `) + 
                chalk.green(`HIT   `) + 
                chalk.gray(`| Key: ${key}:${field}`)
            );
        } else {
            console.log(
                chalk.cyan(`[CACHE] `) + 
                chalk.yellow(`MISS  `) + 
                chalk.gray(`| Key: ${key}:${field}`)
            );
        }
        
        return value ?? undefined;
    } catch (error) {
        console.error(chalk.red(`[CACHE] ERROR | Key: ${key}:${field}`), error);
        return undefined;
    }
}

/**
 * Helper to set a value in a Redis Hash
 */
export async function hashSet(
    key: string,
    field: string,
    value: string
): Promise<boolean> {
    validateKey(key);

    if (!RedisClient || !RedisClient.isReady) {
        console.log(
            chalk.cyan(`[CACHE] `) +
            chalk.red(`SKIP  `) +
            chalk.gray(`| Redis not ready`) +
            chalk.gray(` | Key: ${key}:${field}`)
        );
        return false;
    }

    try {
        await RedisClient.hSet(key, field, value);
        
        console.log(
            chalk.cyan(`[CACHE] `) + 
            chalk.green(`SET   `) + 
            chalk.gray(`| Key: ${key}:${field}`)
        );
        
        return true;
    } catch (error) {
        console.error(chalk.red(`[CACHE] ERROR | Key: ${key}:${field}`), error);
        return false;
    }
}

/**
 * Helper to delete a field from a Redis Hash
 */
export async function hashDel(
    key: string,
    field: string
): Promise<boolean> {
    validateKey(key);

    if (!RedisClient || !RedisClient.isReady) {
        return false;
    }

    try {
        await RedisClient.hDel(key, field);
        
        console.log(
            chalk.cyan(`[CACHE] `) + 
            chalk.yellow(`DEL   `) + 
            chalk.gray(`| Key: ${key}:${field}`)
        );
        
        return true;
    } catch (error) {
        console.error(chalk.red(`[CACHE] ERROR | Key: ${key}:${field}`), error);
        return false;
    }
}

/**
 * Helper to get all fields from a Redis Hash
 */
export async function hashGetAll(
    key: string
): Promise<Record<string, string>> {
    validateKey(key);

    if (!RedisClient || !RedisClient.isReady) {
        return {};
    }

    try {
        const data = await RedisClient.hGetAll(key);
        
        console.log(
            chalk.cyan(`[CACHE] `) + 
            chalk.green(`HIT   `) + 
            chalk.gray(`| Key: ${key} (${Object.keys(data).length} fields)`)
        );
        
        return data;
    } catch (error) {
        console.error(chalk.red(`[CACHE] ERROR | Key: ${key}`), error);
        return {};
    }
}

/**
 * Helper to delete an entire Redis key
 */
export async function cacheDel(key: string): Promise<boolean> {
    validateKey(key);

    if (!RedisClient || !RedisClient.isReady) {
        return false;
    }

    try {
        await RedisClient.del(key);
        
        console.log(
            chalk.cyan(`[CACHE] `) + 
            chalk.yellow(`DEL   `) + 
            chalk.gray(`| Key: ${key}`)
        );
        
        return true;
    } catch (error) {
        console.error(chalk.red(`[CACHE] ERROR | Key: ${key}`), error);
        return false;
    }
}

/**
 * Check if Redis client is ready
 */
export function isRedisReady(): boolean {
    return !!(RedisClient && RedisClient.isReady);
}