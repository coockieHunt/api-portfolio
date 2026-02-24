import express from 'express';
import cors from 'cors';
import compressionLib from 'compression';
import helmet from 'helmet';
import chalk from 'chalk';
import consola from 'consola';
import cookieParser from 'cookie-parser';

import Bree from 'bree';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import cfg from './config/default';
import { createClient } from 'redis';
import { RedisService } from './services/Redis.service';
import { SendmailService } from './services/sendmail/Sendmail.service'; 

import { pingSqlite, initializeSQLiteSchema, closeSqlite } from './utils/sqllite.helper';

import { trackApiCall } from './middlewares/callApiCount.middlewar';
import { allowOnlyFromIPs } from './middlewares/whiteList.middlewar';
import { responseHandler } from './middlewares/responseHandler.middlewar';
import { TestingMiddleware } from './middlewares/testing.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';

import MailRoute from './routes/mail/mail.route';
import GuestBookRoute from './routes/guestbook/guestbook.route';
import HealthRoute from './routes/health/health.route';
import TagsRoute from './routes/tags/tags.route';
import BlogRoute from './routes/blog/blog.route';
import AuthRoute from './routes/auth/auth.route';
import CounterRoute from './routes/counter/counter.route';
import AssetsRoute from './routes/assets/assets.route';
import RouteMap from './routes/sitemap/sitemap.route';
import GatusRoute from './routes/gatus/gatus.route';
import ProjectRoute from './routes/projects/projects.route';
import AuthorsRoute from './routes/authors/authors.route';
import LogsRoute from './routes/logs/logs.route';

import OpenGraphRouter from './routes/proxy/ogImage.route';
import AssetsProxyRoute from './routes/proxy/assetsProxy.route';

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
});

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_ROOT = cfg.ApiRoot;
const ASSET_ROOT = cfg.AssetRoot;

const app = express();
const PORT = cfg.port || 3000;

app.set('trust proxy', 1);
const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        if (cfg.corsOrigins.includes(origin) || cfg.corsOrigins.includes('*')) {
            callback(null, true);
        } else {
            console.log(chalk.yellow(`[CORS]`), `Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

const redisClient = createClient({
    password: cfg.redis.password,
    socket: {
        host: cfg.redis.host,
        port: cfg.redis.port,
        reconnectStrategy: (retries) => {
            if (retries > 3) return new Error("Redis connection failed after 3 attempts");
            return 500;
        }
    }
});

app.use(compressionLib());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
app.use(cors(corsOptions));
app.use(TestingMiddleware);
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(trackApiCall);
app.use(responseHandler);

app.use(`${API_ROOT}/mail`, allowOnlyFromIPs, MailRoute);
app.use(`${API_ROOT}/guestbook`, allowOnlyFromIPs, GuestBookRoute);
app.use(`${API_ROOT}/blog`, allowOnlyFromIPs, BlogRoute);
app.use(`${API_ROOT}/auth`, allowOnlyFromIPs, AuthRoute);
app.use(`${API_ROOT}/tags`, allowOnlyFromIPs, TagsRoute);
app.use(`${API_ROOT}/authors`, allowOnlyFromIPs, AuthorsRoute);
app.use(`${API_ROOT}/assets`, allowOnlyFromIPs, AssetsRoute);
app.use(`${API_ROOT}/projects`, allowOnlyFromIPs, ProjectRoute);
app.use(`${API_ROOT}/logs`, allowOnlyFromIPs, LogsRoute);

app.use(`${API_ROOT}/counter`, CounterRoute);
app.use(`${API_ROOT}/health`, HealthRoute);
app.use(`${API_ROOT}/gatus`, GatusRoute);

app.use(`${API_ROOT}/`, RouteMap);


app.use(`${ASSET_ROOT}/opengraph`, allowOnlyFromIPs, OpenGraphRouter);
app.use(`${ASSET_ROOT}/images`, allowOnlyFromIPs, AssetsProxyRoute);

app.use((req, res, next) => {
    console.log(chalk.red(`[Routeur]`), "404 not found", chalk.gray(" → " + req.originalUrl));
    res.status(404).json({
        success: false,
        message: "Endpoint not found",
        requestedUrl: req.originalUrl
    });
});

app.use(errorHandler);

async function startServer() {
    const requiredEnvVars = ['ACCESS_TOKEN_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingEnvVars.length > 0) {
        consola.fatal(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        process.exit(1);
    }

    if (cfg.fallback.latency || cfg.fallback.sendError) {
        consola.warn('🛑 FALLBACK SIMULATION is ENABLED');
    }

    consola.start('Starting System Services...');

    try {
        await initializeSQLiteSchema();
        pingSqlite();
        consola.success('SQLite Ready', chalk.dim(`(${process.env.DATABASE_URL || 'portfolio.db'})`));

        await RedisService.connectRedis(redisClient as any);
        consola.success('Redis Ready', chalk.dim(`(${cfg.redis.host}:${cfg.redis.port})`));

        await SendmailService.verifySmtpConnection();
        consola.success('SMTP Ready', chalk.dim(`(${process.env.MAIL_HOST})`));

        const CRON_SCHEDULE = process.env.FALLBACK_CACHE_CRON || '0 * * * *';

        const bree = new Bree({
            defaultExtension: process.env.NODE_ENV === 'production' ? 'js' : 'ts',
            root: join(__dirname, 'jobs'),
            logger: false,
            worker: {
                execArgv: process.env.NODE_ENV === 'production' ? [] : ['--import', 'tsx'],
                env: process.env
            },
            jobs: [{ name: 'FallbackCache.jobs', cron: CRON_SCHEDULE }]
        });

        await bree.start();

        bree.on('worker created', (name) => {
            console.log(chalk.dim('────────────────────────────────────────────────────────────'));
            consola.info(chalk.cyanBright(`[Bree] Worker started → ${name}`));
        });

        bree.on('worker deleted', (name) => {
            consola.success(chalk.green(`[Bree] Worker done → ${name}`));
            console.log(chalk.dim('────────────────────────────────────────────────────────────'));
        });

        const connections = new Set<any>();

        async function shutdown(signal: string) {
            consola.warn(`[${signal}] shutdown...`);
        
            setTimeout(() => {
                consola.error('Forced shutdown timeout');
                process.exit(1);
            }, 3000).unref();
        
            try {
                for (const conn of connections) conn.destroy();
        
                await new Promise<void>(resolve => server.close(() => resolve()));
                consola.success('HTTP server closed');
        
                await Promise.race([
                    bree.stop(),
                    new Promise(resolve => setTimeout(resolve, 1000))
                ]);
                consola.success('Bree stopped');
        
                if (redisClient.isOpen) {
                    await redisClient.quit().catch(() => redisClient.disconnect());
                }
                consola.success('Redis closed');
        
                closeSqlite();
                consola.success('SQLite closed');
        
                consola.success('Shutdown complete');
        
                process.exit(0);
        
            } catch (err) {
                consola.error('Error during shutdown:', err);
                process.exit(1);
            }
        }

        process.on('SIGINT', () => shutdown('SIGINT'));  
        process.on('SIGTERM', () => shutdown('SIGTERM')); 
        process.once('SIGUSR2', () => shutdown('SIGUSR2')); 

        let StartBorder = "green"
        if (cfg.fallback.latency || cfg.fallback.sendError) {StartBorder = "yellow"}

        const server = app.listen(Number(PORT), '0.0.0.0', () => {
            consola.box({
                title: chalk.bold.green(' 🚀 SERVER READY '),
                message:
                    `${chalk.greenBright('• PORT:')}   ${chalk.cyan.bold(PORT)} ${chalk.yellowBright(`(http://0.0.0.0:${PORT})`)}\n` +
                    `${chalk.greenBright('• CRON:')}   ${chalk.cyan(CRON_SCHEDULE)} ${chalk.yellowBright('(Worker Threads)')}\n` +
                    `${chalk.greenBright('• ENV:')}    ${chalk.cyan(process.env.NODE_ENV || 'development')}\n` +
                    `${chalk.greenBright('• API Root:')} ${chalk.cyan(API_ROOT)}\n` +
                    `${chalk.greenBright('• Asset Root:')} ${chalk.cyan(ASSET_ROOT)}\n` +
                    `${chalk.greenBright('• Cache TTL:')} ${chalk.cyan(cfg.blog.cache_ttl + 's')}\n` +
                    `${chalk.greenBright('• Fallback Simulation:')} ${cfg.fallback.latency || cfg.fallback.sendError ? chalk.red('ENABLED') : chalk.yellowBright('disabled')}`,
                style: { padding: 1, borderColor: StartBorder, borderStyle: "round" },
            });
        });

        server.on('connection', (conn) => {
            connections.add(conn);
            conn.on('close', () => connections.delete(conn));
        });

    } catch (err: any) {
        consola.fatal('CRITICAL FAILURE DURING STARTUP');
        consola.error(err);
        process.exit(1);
    }
}

startServer();