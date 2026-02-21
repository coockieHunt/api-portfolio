//redis
import type { RedisClientType } from 'redis';

// middlewares
import { logConsole, writeToLog } from '../middlewares/log.middlewar';

//helpers
import { validateKey } from '../utils/redis.helper';

export let RedisClient: RedisClientType;


export class RedisService {
    /**
     * Initializes and connects the Redis client
     * @param client - The Redis client instance to connect
     * @returns Promise that resolves when connection is established
     * @throws {Error} If connection fails
     */
    static async connectRedis(client: RedisClientType): Promise<void> {
        if (RedisClient && RedisClient.isReady) return; 
        
        RedisClient = client; 

        RedisClient.on('error', (err: Error) => {
            writeToLog(`Redis Runtime Error: ${err.message}`, 'redis');
        });
        
        try {
            await RedisClient.connect(); 
            writeToLog('Redis connection established', 'redis');
        } catch (error: any) {
            writeToLog(`Redis initial connection failed: ${error.message}`, 'redis');
            throw new Error(`Could not establish connection to Redis (${error.message})`);
        }
    }

    /**
     * Retrieves a counter value from Redis
     * @param counterName - The Redis key for the counter
     * @returns Promise with counter value and existence status
     * @throws {Error} If Redis client is not connected
     */
    static async getCounter(counterName: string): Promise<{ value: number; exist: boolean }> {
        validateKey(counterName);

        if (!RedisClient || !RedisClient.isReady) {
            writeToLog(`Error: Redis not ready for getCounter(${counterName})`, 'redis');
            throw new Error("Redis client is not connected."); 
        }
        
        try {
            const value = await RedisClient.get(counterName); 
            let numericValue: number;
            let exist: boolean;

            if (value === null) {
                numericValue = 0;
                exist = false;
            } else {
                numericValue = parseInt(value, 10);
                exist = true;
            }

            writeToLog(`GET counter ${counterName} -> value=${numericValue} exist=${exist}`, 'redis');
            return { value: numericValue, exist: exist };

        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('GET', '/counter/', 'FAIL', `Error getting counter ${counterName}`, { error: errorMsg });
            writeToLog(`Error GET counter ${counterName}: ${errorMsg}`, 'redis');
            throw error; 
        }
    }

    /**
     * Sets a counter value in Redis
     * @param counterName - The Redis key for the counter
     * @param value - The value to set (number or string)
     * @returns Promise that resolves when value is set
     * @throws {Error} If Redis client is not connected
     */
    static async setCounter(counterName: string, value: number | string): Promise<void> {
        validateKey(counterName);

        if (!RedisClient || !RedisClient.isReady) throw new Error("Redis client is not connected."); 
        
        try {
            await RedisClient.set(counterName, value.toString()); 
            writeToLog(`SET counter ${counterName} = ${value}`, 'redis');
        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('POST', '/counter/', 'FAIL', `Error setting counter ${counterName}`, { error: errorMsg });
            writeToLog(`Error SET counter ${counterName}: ${errorMsg}`, 'redis');
            throw error;
        }
    }

    /**
     * Atomically increments a counter in Redis
     * @param counterName - The Redis key for the counter
     * @returns Promise with the new counter value
     * @throws {Error} If Redis client is not connected
     */
    static async incrementCounter(counterName: string): Promise<number> {
        validateKey(counterName);

        if (!RedisClient || !RedisClient.isReady) throw new Error("Redis client is not connected."); 
        
        try {
            const newVal = await RedisClient.incr(counterName);
            writeToLog(`INCR counter ${counterName} -> ${newVal}`, 'redis');
            return newVal;
        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('POST', '/counter/increment/', 'FAIL', `Error incrementing counter ${counterName}`, { error: errorMsg });
            writeToLog(`Error INCR counter ${counterName}: ${errorMsg}`, 'redis');
            throw error;
        }
    }
}
