import dotenv from 'dotenv';
dotenv.config({ 
    quiet: true 
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import chalk from 'chalk';
import consola from 'consola';

import cfg from './config/default';
import { createClient } from 'redis';
import { RedisService } from './services/Redis.service';
import { SendmailService } from './services/sendmail/Sendmail.service'; 

import { pingSqlite, initializeSQLiteSchema } from './utils/sqllite.helper';

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

import OpenGraphRouter from './routes/proxy/ogImage.route';
import AssetsProxyRoute from './routes/proxy/assetsProxy.route';

import { startFallbackCacheJob } from './jobs/FallbackCache.jobs';

const API_ROOT = cfg.ApiRoot ;
const ASSET_ROOT = cfg.AssetRoot ;

const app = express();
const PORT = cfg.port || 3000;

app.set('trust proxy', 1); //FIX PROXY NGNIX

// CORS configuration
const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
            return callback(null, true);
        }
        
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

// Initialisation Redis
const redisClient = createClient({
    password: cfg.redis.password,
    socket: {
        host: cfg.redis.host,
        port: cfg.redis.port,
        reconnectStrategy: (retries) => {
            if (retries > 3) { 
                return new Error("Redis connection failed after 3 attempts");
            }
            return 500; //retry att 
        }
    }
});

//load global middlewares
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
app.use(trackApiCall); 
app.use(responseHandler);

// Routes
//allowOnlyFromIPs for ip restriction
app.use(`${API_ROOT}/mail`, allowOnlyFromIPs, MailRoute);
app.use(`${API_ROOT}/guestbook`, allowOnlyFromIPs, GuestBookRoute);
app.use(`${API_ROOT}/blog`, allowOnlyFromIPs, BlogRoute);
app.use(`${API_ROOT}/auth`, allowOnlyFromIPs, AuthRoute);
app.use(`${API_ROOT}/counter`, CounterRoute);
app.use(`${API_ROOT}/health`, HealthRoute);
app.use(`${API_ROOT}/tags`, allowOnlyFromIPs, TagsRoute);
app.use(`${API_ROOT}/authors`, allowOnlyFromIPs, AuthorsRoute);
app.use(`${API_ROOT}/assets`, allowOnlyFromIPs, AssetsRoute);
app.use(`${API_ROOT}/projects`, allowOnlyFromIPs, ProjectRoute);
app.use(`${API_ROOT}/gatus`, GatusRoute);
app.use(`${API_ROOT}/`, RouteMap);


//asset
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

// run
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

    consola.info(chalk.bold('Configuration Loaded:'));
    console.log(`  ${chalk.blue('• API Root:')}   ${API_ROOT}`);
    console.log(`  ${chalk.blue('• Asset Root:')} ${ASSET_ROOT}`);
    console.log(`  ${chalk.blue('• Cache TTL:')}  ${cfg.blog.cache_ttl} seconds\n`);

    consola.start('Starting System Services...');

    try {
        await initializeSQLiteSchema();
        pingSqlite();
        consola.success('SQLite Ready', chalk.dim(`(${process.env.DATABASE_URL || 'portfolio.db'})`));

        await RedisService.connectRedis(redisClient as any);
        consola.success('Redis Ready', chalk.dim(`(${cfg.redis.host}:${cfg.redis.port})`));

        await SendmailService.verifySmtpConnection();
        consola.success('SMTP Ready', chalk.dim(`(${process.env.MAIL_HOST})`));

        // Start Fallback Cache Job
        await startFallbackCacheJob();
        consola.success('Fallback Cache Job Started', chalk.dim(`(${process.env.FALLBACK_CACHE_CRON || '0 * * * *'})`));

        app.listen(Number(PORT), '0.0.0.0', () => {
            consola.box({
                title: chalk.bold.green(' 🚀 SERVER READY '),
                message: `Server listening on port: ${chalk.cyan.bold(PORT)}\nhttp://0.0.0.0:${PORT}`,
                style: {
                    padding: 1,
                    borderColor: "green",
                    borderStyle: "round",
                },
            });
        });

    } catch (err: any) {
        consola.fatal('CRITICAL FAILURE DURING STARTUP');
        consola.error(err); 
        process.exit(1);
    }
}

startServer();