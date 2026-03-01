import path from 'path'; 
import fs from 'fs';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import chalk from 'chalk';
import consola from 'consola';

// config
import cfg from '../config/default.ts';


interface LogConfigInterface {
    directory: string;
    name: Record<string, string>;
}

const loggersMap = new Map<string, winston.Logger>();
interface ChalkStyle extends Function {
    (text: string | number | boolean | null | undefined): string;
}

const METHOD_COLORS: Record<string, ChalkStyle> = {
    GET: chalk.blue,
    POST: chalk.green,
    PUT: chalk.yellow,
    DELETE: chalk.red,
    PATCH: chalk.magenta,
};

/**
 * Retrieves or creates a Winston logger for a specific log type
 * 
 * Creates daily rotating file loggers with automatic compression and cleanup.
 * Cached loggers are reused for better performance.
 * 
 * @param type - The log category/type (e.g., 'error', 'access', 'blog')
 * @returns A configured Winston logger instance
 * @private
 */
const getLogger = (type: string): winston.Logger => {
    if (loggersMap.has(type)) return loggersMap.get(type)!;

    const LogConfig = (cfg?.Log || {}) as LogConfigInterface;
    const logDirectory: string = process.env.LOG_DIR || LogConfig.directory || './logs';
    const filename: string = (LogConfig.name && LogConfig.name[type])
        ? (LogConfig.name[type] as any).file ?? `${type}.log`
        : `${type}.log`;

    try {
        const dirPath = path.resolve(logDirectory);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } catch (e) {
        console.error("Failed to create log directory", e);
    }

    const transport = new DailyRotateFile({
        dirname: logDirectory,
        filename: filename + '-%DATE%',
        datePattern: 'YYYY-WW',
        zippedArchive: true,
        frequency: process.env.LOG_ROTATION_FREQUENCY || '7d',
        maxSize: '20m',
        maxFiles: process.env.LOG_MAX_FILES || '4w',
        createSymlink: true,
        symlinkName: filename
    });

    const logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, message }) => `${timestamp} - ${message}`)
        ),
        transports: [transport]
    });

    loggersMap.set(type, logger);
    return logger;
};



/**
 * Writes a log message to a file based on category
 * 
 * Uses Winston with daily rotation. Automatically creates log directories.
 * Falls back to console logging if file writing fails.
 * 
 * @param log - The message to log
 * @param type - The log category (determines which file to write to)
 */
export const writeToLog = (log: string, type: string): void => {
    try {
        const logger = getLogger(type);
        logger.info(log);
    } catch (err) {
        console.error("Logging error:", err);
        console.log(`[${type}] ${log}`);
    }
};

/**
 * Logs formatted messages to console with colors
 * 
 * Provides structured, color-coded console output for HTTP operations.
 * Supports placeholder substitution and additional context args.
 * 
 * @param method - HTTP method or label (GET, POST, MIDDLEWARE, etc.)
 * @param route - API route or context path
 * @param status - Operation status (OK, FAIL, INFO, WARN)
 * @param message - Main log message (can include {placeholder} for substitution)
 * @param args - Additional context as key-value pairs
 */
export const logConsole = (
    method: string,
    route: string,
    status: 'OK' | 'FAIL' | 'INFO' | 'WARN',
    message: string,
    args: Record<string, any> = {}
): void => {
    const methodUpper = method.toUpperCase();
    const colorFn = METHOD_COLORS[methodUpper] || chalk.white;
    const tag = colorFn(`${methodUpper} ${route}`);
    
    const logger = consola.withTag(tag);

    let description = message;
    const extra: string[] = [];

    Object.entries(args).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        const displayValue = chalk.white.bold(String(value));

        if (description.includes(placeholder)) {
            description = description.split(placeholder).join(displayValue);
        } else {
            extra.push(`${chalk.grey(key)}=${chalk.white(value)}`);
        }
    });

    const finalMessage = extra.length > 0 
        ? `${description} ${chalk.grey('→')} ${extra.join(' ')}` 
        : description;

    switch (status) {
        case 'OK':
            logger.success(finalMessage);
            break;
        case 'FAIL':
            logger.error(finalMessage);
            break;
        case 'WARN':
            logger.warn(finalMessage);
            break;
        case 'INFO':
        default:
            logger.info(finalMessage);
            break;
    }
};