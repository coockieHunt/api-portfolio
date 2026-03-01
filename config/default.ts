import dotenv from 'dotenv';
dotenv.config();

import staticConfig from '../static.config.json' with { type: 'json' };
import rateLimiterConfig from '../config_rateLimiter.json' with { type: 'json' };
import { parseList } from '../utils/redis.helper.ts';

interface MailTransportConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
}

interface LogConfig {
	maxLine: number;
	directory: string;
	name: Record<LogType, LogNameConfig>
}

type LogNameConfig = {
	file: string;
	api: boolean;
};

// dynamic type for log for repitition in code
const LOG_NAMES = staticConfig.log.names as Record<string, LogNameConfig>;
export type LogType = keyof typeof LOG_NAMES;
export const LOG_TYPES = Object.freeze(
	Object.keys(LOG_NAMES).reduce((acc, key) => {
		const typedKey = key as LogType;
		acc[typedKey] = typedKey;
		return acc;
	}, {} as Record<LogType, LogType>)
);

interface RedisConfig {
	host: string;
	port: number;
	password?: string;
}

interface RateLimiterConfig {
	enabled: boolean;
	default: {
		windowSeconds: number;
		maxRequests: number;
	};
	routes: any; 
}

interface blogConfig {
	cache_ttl: number;
	cache_client_age: number;
	og_image: boolean;
}

interface AppConfig {
	port: number;
	ApiRoot: string;
	AssetRoot: string;
	MailTransport: MailTransportConfig;
	allowedIPs: string[];
	corsOrigins: string[];
	Log: LogConfig;
	redis: RedisConfig;
	SecretSystem: { password?: string };
	rateLimiter: RateLimiterConfig;
	blog: blogConfig;
	fallback: {
		latency: boolean;
		delayLatency: number;
		sendError: boolean;
		errorIn: number;
	};
}


const config: AppConfig = {
	port: Number(process.env.PORT || 3001),
	ApiRoot: process.env.API_ROOT || "/api",
	AssetRoot: process.env.ASSET_ROOT || "/assets",

	MailTransport: {
		host: process.env.MAIL_HOST || "smtp.example.com",
		port: Number(process.env.MAIL_PORT || "465"),
		secure: String(process.env.MAIL_SECURE || "true").toLowerCase() === 'true',
		user: process.env.MAIL_USER || "user@example.com",
		pass: process.env.MAIL_PASS || "password"
	},

	allowedIPs: parseList(process.env.IP_WHITELIST || "::1,::ffff:127.0.0.1"),

	corsOrigins: parseList(process.env.CORS_ORIGINS || "http://localhost:3000"),

	Log: {
		maxLine: staticConfig.log.maxLine,
		directory: process.env.LOG_DIR || "logs",
		name: LOG_NAMES as Record<LogType, LogNameConfig>
	},

	redis: {
		host: process.env.REDIS_HOST || "localhost",
		port: Number(process.env.REDIS_PORT || "6379"),
		password: process.env.REDIS_PASSWORD || ""
	},

	SecretSystem: {
		password: process.env.SECRET_PASSWORD || staticConfig.secretSystem.password,
	},

	rateLimiter: {
		enabled: String(process.env.RATE_LIMITER_ENABLED || rateLimiterConfig.enabled).toLowerCase() === 'true',
		default: {
			windowSeconds: rateLimiterConfig.default.windowSeconds,
			maxRequests: rateLimiterConfig.default.maxRequests
		},
		routes: rateLimiterConfig.routes
	},

	blog: {
		cache_ttl: Number(process.env.BLOG_CACHE_TTL || staticConfig.blog?.cache_ttl || 86400),
		cache_client_age: Number(process.env.BLOG_CACHE_CLIENT_AGE || staticConfig.blog?.cache_client_age || 300),
		og_image: Boolean(process.env.BLOG_OG_CACHE ?? (staticConfig.blog?.og_image ?? true))
	},

	fallback: {
		latency: String(process.env.TESTING_LATENCY_ENABLED || "false").toLowerCase() === 'true',
		delayLatency: Number(process.env.TESTING_LATENCY_DELAY || 1000),
		sendError: String(process.env.TESTING_ERROR_ENABLED || "false").toLowerCase() === 'true',
		errorIn: Number(process.env.TESTING_ERROR_IN || 1000)
	}
};

export default config;