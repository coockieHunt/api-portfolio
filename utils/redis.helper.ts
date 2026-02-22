//constants
import { AUTHORIZED_REDIS_KEYS, AUTHORIZED_REDIS_PREFIXES } from "../constants/redis.constant.ts";

//middlewares
import { writeToLog } from "../middlewares/log.middlewar.ts";

//console
import chalk from "chalk";

// parselist from redis
export const parseList = (val: string | undefined, fallback: string[] = []): string[] => {
	if (!val || typeof val !== 'string') return fallback;
	return val
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);
};

export const validateKey = (key: string): void => {
	const authorizedValues = Object.values(AUTHORIZED_REDIS_KEYS) as string[];
	const authorizedPrefixes = Object.values(AUTHORIZED_REDIS_PREFIXES) as string[];

	const isExactMatch = authorizedValues.includes(key);
	const isDynamicMatch = authorizedPrefixes.some(prefix => key.startsWith(prefix));

	if (!isExactMatch && !isDynamicMatch) {
		writeToLog(`Security Alert: Unauthorized Redis key access attempted: ${key}`, 'redis');
		console.error(chalk.red(`⚠️ Unauthorized Redis key access attempted: ${key}`));
	}
}