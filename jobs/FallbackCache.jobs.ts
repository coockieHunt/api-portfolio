import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as cron from 'node-cron';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BlogService } from '../services/blog/Blog.service';
import { ProjectsService } from '../services/projects/Projects.service';
import { TagService } from '../services/tag/Tag.service';
import { logConsole, writeToLog } from '../middlewares/log.middlewar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = process.env.NODE_ENV === 'production' 
    ? '/shared-cache' 
    : resolve(__dirname, '../../portfolio_reworks/public/fallback'); 

const OUTPUT_LATEST_BASENAME = 'worker_cache.json';
const LOG_FILE = join(OUTPUT_DIR, 'backup-log.json');
const LOG_MAX_ENTRIES = 100;

const formatDate = (date: Date): string => {
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const log = {
    info: (msg: string) => console.log(`\x1b[32m[${formatDate(new Date())}]\x1b[0m ${msg}`),
    warn: (msg: string) => console.warn(`\x1b[33m[${formatDate(new Date())}]\x1b[0m ${msg}`),
    error: (msg: string, error?: unknown) => console.error(`\x1b[31m[${formatDate(new Date())}] ${msg}\x1b[0m`, error ?? ''),
};

const buildTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const buildCacheData = async () => {
    const blogData = await BlogService.getAllPosts(1, 5, false);
    const projects = await ProjectsService.getAllProjects(false);
    const tags = await TagService.getAllTags(false);

    const posts = blogData.posts.map((item: any) => {
        const { featuredImage, ...postWithoutImage } = item.post;
        return {
            ...item,
            post: postWithoutImage,
        };
    });

    const projectsWithoutImages = projects.map((project: any) => {
        const { gallery, ...projectWithoutImages } = project;
        return projectWithoutImages;
    });

    return {
        blog: {
            meta: blogData.meta,
            posts,
        },
        projects: projectsWithoutImages,
        tags: tags.tags,
    };
};

const saveCacheToFile = async (payload: unknown) => {
    await mkdir(OUTPUT_DIR, { recursive: true });

    const latestPath = join(OUTPUT_DIR, OUTPUT_LATEST_BASENAME);

    const content = JSON.stringify(payload, null, 2);
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
            if (Array.isArray(parsed)) {
                existing = parsed as Array<{ buildTime: number; file: string; sizeBytes: number; timestamp: string }>;
            }
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
        log.error('Failed to write backup log', error);
    }
};

const runCacheBackup = async () => {
    const startedAt = Date.now();

    try {
        log.info('Building fallback cache...');
        
        const cacheData = await buildCacheData();
        const filePath = await saveCacheToFile(cacheData);
        const buildDurationMs = Date.now() - startedAt;
        
        await appendBackupLog(filePath, buildDurationMs);

        log.info(`Cache saved to ${filePath} (${buildDurationMs}ms)`);
        
        logConsole('JOB', 'FallbackCache', 'INFO', 'Fallback cache built', {
            posts: cacheData.blog.posts.length,
            projects: cacheData.projects.length,
            tags: cacheData.tags.length,
            duration: buildDurationMs,
        });
        
        writeToLog(
            `Fallback cache built: posts=${cacheData.blog.posts.length} projects=${cacheData.projects.length} tags=${cacheData.tags.length} (${buildDurationMs}ms)`,
            'worker'
        );
    } catch (error) {
        log.error('Failed to build fallback cache', error);
        logConsole('JOB', 'FallbackCache', 'FAIL', 'Failed to build fallback cache', { error });
        writeToLog('Fallback cache build failed', 'worker');
    }
};

export const startFallbackCacheJob = async () => {
    const CRON_SCHEDULE = process.env.FALLBACK_CACHE_CRON || '0 * * * *';

    log.info('Starting Fallback Cache Job...');
    log.info(`CRON_SCHEDULE: ${CRON_SCHEDULE}`);
    log.info(`OUTPUT_DIR: ${OUTPUT_DIR}`);

    try {
        await runCacheBackup();
        log.info('Initial fallback cache generated successfully');
    } catch (error) {
        log.error('Initial cache backup failed', error);
    }

    cron.schedule(CRON_SCHEDULE, () => {
        runCacheBackup().catch((error) => {
            log.error('Fallback cache job failed on scheduled run', error);
        });
    });

    log.info(`Fallback Cache Job scheduled — ${CRON_SCHEDULE} ⏰`);
};