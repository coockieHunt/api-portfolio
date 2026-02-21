import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as cron from 'node-cron';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BlogService } from '../services/blog/Blog.service';
import { ProjectsService } from '../services/projects/Projects.service';
import { TagService } from '../services/tag/Tag.service';
import { logConsole, writeToLog } from '../middlewares/log.middlewar';
import chalk from 'chalk';
import consola from 'consola';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = process.env.NODE_ENV === 'production' 
    ? '/shared-cache' 
    : resolve(__dirname, '../../portfolio_reworks/public/fallback'); 

const OUTPUT_LATEST_BASENAME = 'worker_cache.json';
const LOG_FILE = join(OUTPUT_DIR, 'backup-log.json');
const LOG_MAX_ENTRIES = 100;

// Suppression de la fonction `formatDate` et de l'objet `log` personnalisés, 
// Consola gère le formatage et les timestamps nativement beaucoup mieux.

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
        // Remplacement par consola.error
        consola.error(chalk.red('Failed to write backup log:'), error);
    }
};

const runCacheBackup = async () => {
    const startedAt = Date.now();

    try {
        consola.start(chalk.cyan('Building fallback cache data...'));
        
        const cacheData = await buildCacheData();
        const filePath = await saveCacheToFile(cacheData);
        const buildDurationMs = Date.now() - startedAt;
        
        await appendBackupLog(filePath, buildDurationMs);

        consola.success(`Cache saved to ${chalk.magentaBright(filePath)} ${chalk.dim(`(${buildDurationMs}ms)`)}`);
        
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
        consola.error(chalk.bgRed.white.bold(' Failed to build fallback cache '), error);
        logConsole('JOB', 'FallbackCache', 'FAIL', 'Failed to build fallback cache', { error });
        writeToLog('Fallback cache build failed', 'worker');
        
        // IMPORTANT : On relance l'erreur pour que startFallbackCacheJob sache que ça a planté
        throw error; 
    }
};

export const startFallbackCacheJob = async () => {
    const CRON_SCHEDULE = process.env.FALLBACK_CACHE_CRON || '0 * * * *';

    consola.box({
        title: chalk.bold.cyanBright(' 🛡️  Fallback Cache Job '),
        message: `${chalk.greenBright('• CRON:')}   ${chalk.cyan(CRON_SCHEDULE)}\n` +
                 `${chalk.greenBright('• Output:')} ${chalk.magentaBright(OUTPUT_DIR)}\n` +
                 `${chalk.greenBright('• File:')}   ${chalk.yellowBright(OUTPUT_LATEST_BASENAME)}`,
        style: {
            padding: 1,
            borderColor: 'cyan',
            borderStyle: 'round',
        },
    });
    
    try {
        consola.start(chalk.italic('Starting initial fallback cache generation...'));
        await runCacheBackup();
        consola.success(chalk.green('Initial fallback cache generated successfully! ✨'));
    } catch (error) {
        consola.error(chalk.bgRed.white.bold(' Initial cache backup failed ❌ '), error);
    }
    
    cron.schedule(CRON_SCHEDULE, async () => {
        consola.info(chalk.dim(`[Cron] Running scheduled cache backup...`));
        
        try {
            await runCacheBackup();
            consola.success(chalk.green.dim('[Cron] Cache backup completed successfully.'));
        } catch (error) {
            consola.error(chalk.red.bold('[Cron] Fallback cache job failed on scheduled run ❌'), error);
        }
    });
    
    consola.ready({
        message: `Fallback Cache Job active — Next run at ${chalk.cyan.bold(CRON_SCHEDULE)} ⏰`,
        badge: true
    });
};