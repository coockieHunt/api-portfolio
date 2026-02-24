import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parentPort } from 'node:worker_threads'; 
import chalk from 'chalk';
import consola from 'consola';

import { BlogService } from '../services/blog/Blog.service.ts';
import { ProjectsService } from '../services/projects/Projects.service.ts';
import { TagService } from '../services/tag/Tag.service.ts';
import { logConsole, writeToLog } from '../middlewares/log.middlewar.ts';

import { RedisService } from '../services/Redis.service.ts';
import { createClient } from 'redis';
import cfg from '../config/default.ts';


const rawPath = process.env.FALLBACK_CACHE_DIR || './portfolio_reworks/public/fallback';
const OUTPUT_DIR = resolve(process.cwd(), rawPath);

const OUTPUT_LATEST_BASENAME = 'worker_cache.json';
const LOG_FILE = join(OUTPUT_DIR, 'backup-log.json');
const LOG_MAX_ENTRIES = 100;

const buildCacheData = async () => {
    const [blogData, projects, tags] = await Promise.all([
        BlogService.getAllPosts(1, 5, false),
        ProjectsService.getAllProjects(false),
        TagService.getAllTags(false),
    ]);

    const posts = blogData.posts.map((item: any) => {
        const { featuredImage, ...postWithoutImage } = item.post;
        return { ...item, post: postWithoutImage };
    });

    const projectsWithoutImages = projects.map((project: any) => {
        const { gallery, ...projectWithoutImages } = project;
        return projectWithoutImages;
    });

    return {
        blog: { meta: blogData.meta, posts },
        projects: projectsWithoutImages,
        tags: tags.tags,
    };
};

const saveCacheToFile = async (payload: unknown) => {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const latestPath = join(OUTPUT_DIR, OUTPUT_LATEST_BASENAME);
    
    const isProd = process.env.NODE_ENV === 'production';
    const content = isProd ? JSON.stringify(payload) : JSON.stringify(payload, null, 2);
    
    await writeFile(latestPath, content, 'utf8');
    return latestPath;
};

const appendBackupLog = async (filePath: string, buildDurationMs: number) => {
    try {
        await mkdir(OUTPUT_DIR, { recursive: true });
        let existing: Array<{ buildTime: number; file: string; sizeBytes: number; timestamp: string }> = [];
        try {
            const content = await readFile(LOG_FILE, 'utf8');
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) existing = parsed;
        } catch {
            existing = [];
        }

        const { size } = await stat(filePath);
        existing.push({ 
            buildTime: buildDurationMs, 
            file: filePath, 
            sizeBytes: size,
            timestamp: new Date().toISOString()
        });
        
        if (existing.length > LOG_MAX_ENTRIES) {
            existing = existing.slice(-LOG_MAX_ENTRIES);
        }
        await writeFile(LOG_FILE, JSON.stringify(existing, null, 2), 'utf8');
    } catch (error) {
        consola.error(chalk.red('[Worker] Failed to write backup log:'), error);
    }
};

const runWorker = async () => {
    const startedAt = Date.now();
    let redisClientWorker: any = null;

    try {
        redisClientWorker = createClient({
            password: cfg.redis.password,
            socket: { host: cfg.redis.host, port: cfg.redis.port }
        });
        await RedisService.connectRedis(redisClientWorker);

        consola.info(chalk.cyan.dim('[Worker] Building fallback cache data...'));
        
        const cacheData = await buildCacheData();
        const filePath = await saveCacheToFile(cacheData);
        const buildDurationMs = Date.now() - startedAt;
        
        await appendBackupLog(filePath, buildDurationMs);

        consola.success(`[Worker] Cache saved to ${chalk.magentaBright(filePath)} ${chalk.dim(`(${buildDurationMs}ms)`)}`);
        
        logConsole('JOB', 'FallbackCache', 'INFO', 'Fallback cache built', {
            posts: cacheData.blog.posts.length,
            projects: cacheData.projects.length,
            tags: cacheData.tags.length,
            duration: buildDurationMs,
        });
        
        writeToLog(`Fallback cache built: posts=${cacheData.blog.posts.length} projects=${cacheData.projects.length} tags=${cacheData.tags.length} (${buildDurationMs}ms)`, 'worker');

        await redisClientWorker.quit();


        if (parentPort) parentPort.postMessage('done');
        process.exit(0);

    } catch (error) {
        consola.error(chalk.bgRed.white.bold(' [Worker] Failed to build fallback cache '), error);
        
        if (redisClientWorker) await redisClientWorker.quit();

        console.log(chalk.dim('────────────────────────────────────────────────────────────'));
        
        if (parentPort) parentPort.postMessage('error');
        process.exit(1); 
    }
};

runWorker();