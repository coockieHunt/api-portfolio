import { RedisService, RedisClient } from '../../services/Redis.service.ts'; 
import type {Request, Response} from 'express';
import { writeToLog, logConsole } from '../../middlewares/log.middlewar.ts';
import { AUTHORIZED_REDIS_KEYS, AUTHORIZED_REDIS_PREFIXES } from '../../constants/redis.constant.ts';

class CounterController {
    private normalizeAuthorizedRedisValue = (value: string): string | null => {
        const normalizedValue = value.trim();
        const authorizedKeys = Object.values(AUTHORIZED_REDIS_KEYS);
        if (authorizedKeys.includes(normalizedValue as (typeof authorizedKeys)[number])) {
            return normalizedValue;
        }

        const authorizedPrefixes = Object.values(AUTHORIZED_REDIS_PREFIXES);
        const matchedFullPrefix = authorizedPrefixes.find((prefix) => normalizedValue.startsWith(prefix));
        if (matchedFullPrefix) {
            return normalizedValue;
        }

        for (const fullPrefix of authorizedPrefixes) {
            const shortPrefix = fullPrefix.startsWith('portfolio:')
                ? fullPrefix.slice('portfolio:'.length)
                : fullPrefix;

            if (normalizedValue.startsWith(shortPrefix)) {
                const suffix = normalizedValue.slice(shortPrefix.length);
                return `${fullPrefix}${suffix}`;
            }
        }

        return null;
    }

    private getValidatedRedisKey = (name: string): string | null => {
        if (!name || typeof name !== 'string' || name.trim() === '') { 
            return null;    
        }

        const normalizedName = name.trim();
        const upperName = normalizedName.toUpperCase();

        const fixedKey = AUTHORIZED_REDIS_KEYS[upperName as keyof typeof AUTHORIZED_REDIS_KEYS];
        if (fixedKey) {
            return fixedKey;
        }

        const authorizedPrefix = AUTHORIZED_REDIS_PREFIXES[upperName as keyof typeof AUTHORIZED_REDIS_PREFIXES];
        if (authorizedPrefix) {
            return authorizedPrefix;
        }

        const normalizedRedisValue = this.normalizeAuthorizedRedisValue(normalizedName);
        if (normalizedRedisValue) {
            return normalizedRedisValue;
        }

        return null; 
    }

    public validateRedisKey = (value: string): boolean => {
        if (!this.getValidatedRedisKey(value)) {
            throw new Error('Invalid counter name');
        }
        return true;
    };

    /**
     ** GET /:name get value of counter
     ** Retrieves the counter value. Creates and initializes to 0 if non-existent.
     *  @param req Express Request object
     *  @param res Express Response object
     */
     getCounter = async (req: Request<{ name: string }>, res: Response) => {
        const { name } = req.params; 
        const redisKey = this.getValidatedRedisKey(name);

        if (!redisKey) {return res.error('Counter name is required and must be valid.', 400);}

        try {
            const { value, exist } = await RedisService.getCounter(redisKey); 

            if (!exist) {
                logConsole('GET', `/counter/${name}`, 'WARN', `Counter not found`, { redisKey });
                writeToLog(`Counter GET not found name=${name}`, 'counter');
                return res.idNotFound(name, `Counter ${name} not found`);
            }

            logConsole('GET', `/counter/${name}`, 'INFO', `Retrieved counter value`, { redisKey, value, exist });
            writeToLog(`Counter GET name=${name} key=${redisKey} value=${value} exist=${exist}`, 'counter');

            return res.success({ 
                counterName: name, 
                redisKey: redisKey, 
                counterValue: value,
                exist: exist
            });

        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('GET', `/counter/${name}`, 'FAIL', `Error retrieving counter value`, { error: errorMsg, redisKey });
            writeToLog(`Counter GET error name=${name}: ${errorMsg}`, 'counter');
            return res.error('An error occurred while getting the counter value.', 500, errorMsg);
        }
    }

    /**
     ** POST /:name/increment
     ** Increments the counter value. If non-existent, it is created and set to 1.
     *  @param req Express Request object
     *  @param res Express Response object
    */
    incrementCounter = async (req: Request<{ name: string }>, res: Response) => {
        const { name } = req.params;
        const redisKey = this.getValidatedRedisKey(name);

        if (!redisKey) {return res.error('Counter name is required and must be valid.', 400);}

        if (!RedisClient || !RedisClient.isReady) {
            logConsole('POST', `/counter/${name}/increment`, 'WARN', `Redis service unavailable`, { name });
            writeToLog('Counter INCR redis not connected', 'counter');
            return res.error('Redis service is unavailable.', 503);
        }
        
        try {
            const existBefore = await RedisClient.exists(redisKey);

            const newValue = await RedisService.incrementCounter(redisKey);
            const exist = existBefore === 1;
            logConsole('POST', `/counter/${name}/increment`, 'OK', `Incremented counter value`, { redisKey, newValue, exist });
            writeToLog(`Counter INCR name=${name} key=${redisKey} newValue=${newValue} existedBefore=${exist}`, 'counter');

            return res.success({ 
                counterName: name, 
                redisKey: redisKey, 
                counterValue: newValue,
                exist: exist
            });
        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('POST', `/counter/${name}/increment`, 'FAIL', `Error incrementing counter value`, { error: errorMsg, redisKey });
            
            const isRedisNotConnected = errorMsg.includes('Redis client is not connected');
            if (isRedisNotConnected) {
                writeToLog(`Counter INCR not connected name=${name}`, 'counter');
                return res.error('Redis client is not connected.', 503);
            }

            writeToLog(`Counter INCR error name=${name}: ${errorMsg}`, 'counter');
            return res.error('An error occurred while incrementing the counter value.', 500, errorMsg);
        }
    }

    /**
     ** POST /:name/decrement
    ** Decrements the counter value.
    *  @param req Express Request object
    *  @param res Express Response object
    */
    decrementCounter = async (req: Request<{ name: string }>, res: Response) => {
        const { name } = req.params;
        const redisKey = this.getValidatedRedisKey(name);

        if (!redisKey) {return res.error('Counter name is required and must be valid.', 400);}

        if (!RedisClient || !RedisClient.isReady) {
            logConsole('POST', `/counter/${name}/decrement`, 'WARN', `Redis service unavailable`, { name });
            writeToLog('Counter DECR redis not connected', 'counter');
            return res.error('Redis service is unavailable.', 503);
        }
        
        try {
            const existBefore = await RedisClient.exists(redisKey);
            const currentValue = await RedisClient.get(redisKey);
            if(currentValue === "0") {
                logConsole('POST', `/counter/${name}/decrement`, 'WARN', `Counter value is already at 0`, { redisKey });
                writeToLog(`Counter DECR name=${name} key=${redisKey} already at 0`, 'counter');
                return res.error('Counter value is already at 0 and cannot decrement below 0.', 400);
            }
            const newValue = await RedisClient.decr(redisKey);
            const exist = existBefore === 1;
            logConsole('POST', `/counter/${name}/decrement`, 'OK', `Decremented counter value`, { redisKey, newValue, exist });
            writeToLog(`Counter DECR name=${name} key=${redisKey} newValue=${newValue} existedBefore=${exist}`, 'counter');

            return res.success({ 
                counterName: name, 
                redisKey: redisKey, 
                counterValue: newValue,
                exist: exist
            });
        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('POST', `/counter/${name}/decrement`, 'FAIL', `Error decrementing counter value`, { error: errorMsg, redisKey });
            
            const isRedisNotConnected = errorMsg.includes('Redis client is not connected');
            if (isRedisNotConnected) {
                writeToLog(`Counter DECR not connected name=${name}`, 'counter');
                return res.error('Redis client is not connected.', 503);
            }

            writeToLog(`Counter DECR error name=${name}: ${errorMsg}`, 'counter');
            return res.error('An error occurred while decrementing the counter value.', 500, errorMsg);
        }
    }

    /**
     ** DELETE /:name
    ** Reset the counter value to 0.
    *  @param req Express Request object
    *  @param res Express Response object
    */
    resetCounter = async (req: Request<{ name: string }>, res: Response) => {
        const { name } = req.params;
        const redisKey = this.getValidatedRedisKey(name);

        if (!redisKey) {return res.error('Counter name is required and must be valid.', 400);}

        try {
            await RedisService.setCounter(redisKey, 0);
            logConsole('DELETE', `/counter/${name}`, 'OK', `Reset counter value`, { redisKey });
            writeToLog(`Counter RESET name=${name} key=${redisKey}`, 'counter');
            return res.success({ 
                counterName: name,
                redisKey: redisKey,
                counterValue: 0,
                exist: true,
                message: `Counter ${name} has been reset to 0.` 
            });
        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('DELETE', `/counter/${name}`, 'FAIL', `Error resetting counter value`, { error: errorMsg, redisKey });
            writeToLog(`Counter RESET error name=${name}: ${errorMsg}`, 'counter');
            return res.error('An error occurred while resetting the counter value.', 500, errorMsg);
        }
    }
}

export default new CounterController();