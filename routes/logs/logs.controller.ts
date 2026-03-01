import { readFileSync, existsSync } from 'fs';
import type { Request, Response } from 'express';
import { bree } from '../../app';
import { logConsole, writeToLog } from '../../middlewares/log.middlewar';
import cfg, { LOG_TYPES } from '../../config/default.ts';

class LogsController {
    async GetFallBackList(req: Request, res: Response) {
        const FALLBACK_INDEX = process.env.FALLBACK_CACHE_DIR + '/backup-log.json';
        
        try {
            const data = JSON.parse(readFileSync(FALLBACK_INDEX!, 'utf-8'));
            writeToLog("[Logs] Fallback cache list retrieved successfully.", LOG_TYPES.logs);
            logConsole('GET', '/logs/fallback/list', 'OK', 'Retrieved fallback cache list', { count: data.length });
            return res.success({ backups: data });
        } catch (error) {
            writeToLog("[Logs] Error reading fallback cache file:", LOG_TYPES.logs );
            logConsole('GET', '/logs/fallback/list', 'FAIL', 'Error reading fallback cache file', { error });
            return res.error("Failed to read fallback logs.", 500);
        }
    }

    async GetInfoByFilename(req: Request, res: Response) {
        const FALLBACK_DIR = process.env.FALLBACK_CACHE_DIR + "/worker_cache.json";

        try {
            const filePath = `${FALLBACK_DIR}`;
            const content = readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            writeToLog("[Logs] Fallback log retrieved successfully.", LOG_TYPES.logs);
            logConsole('GET', '/logs/fallback/view', 'OK', 'Retrieved fallback log', { file: FALLBACK_DIR });
            return res.success({ log: data });
        } catch (error) {
            writeToLog(`[Logs] Error reading fallback log file ${FALLBACK_DIR}:`, LOG_TYPES.logs);
            logConsole('GET', '/logs/fallback/view', 'FAIL', 'Error reading fallback log file', { error });
            return res.error("Failed to read fallback log.", 500);
        }
    }

    async PostFallBackForce(req: Request, res: Response) {
        try {
            if (!bree) {
                console.error("[Logs] Bree instance is not initialized yet.");
                return res.error("process not ready", 500);
            }

            const jobName = 'FallbackCache.jobs';
            
            await bree.run(jobName);

            writeToLog(`[Logs] Manual trigger: Job ${jobName} started.`, LOG_TYPES.logs);
            logConsole('POST', '/logs/fallback/force', 'OK', `Manual trigger: Job ${jobName} started.`, { jobName });
            return res.success({ message: "manual cache refresh started" });

        } catch (error: any) {
            if (error.message?.includes('already running')) {
                return res.error("job already running", 409);
            }

            writeToLog("[Logs] Bree fallback cache error:", LOG_TYPES.logs);
            logConsole('POST', '/logs/fallback/force', 'FAIL', 'Error during fallback cache build', { error });
            return res.error("error during fallback cache build", 500);
        }
    }

    async GetLogsList(req: Request, res: Response) {
        const file  = (req.query.file as string) || 'system'
        const limit = parseInt(req.query.limit as string) || 200

        const logConfig = cfg.Log.name[file] 

        if (file.includes('/') || file.includes('..')) {
            logConsole('GET', '/logs/list', 'FAIL', 'Invalid file name in request', { file });
            writeToLog(`[Logs] Invalid file name in request: ${file}`, LOG_TYPES.logs);
            return res.error('Invalid file name', 400)
        }

        if (!logConfig || !logConfig.api) {
            logConsole('GET', '/logs/list', 'FAIL', `Log file "${file}" not found or not accessible`, { file });
            writeToLog(`[Logs] Log file "${file}" not found or not accessible`, LOG_TYPES.logs);
            return res.error(`Log file "${file}" not found or not accessible`, 404)
        }

        const LOG_FILE = `${process.cwd()}/logs/${logConfig.file}`

        if (!existsSync(LOG_FILE)) {
            logConsole('GET', '/logs/list', 'FAIL', `Log file not found on disk`, { file, path: LOG_FILE });
            return res.success({ logs: [], file, total: 0 })
        }

        const parseLogLine = (line: string) => {
            try {
                return JSON.parse(line)
            } catch {
                const plainMatch = line.match(/^(.*?)\s-\s(.*)$/)
                if (plainMatch) {
                    return {
                        level: 'log',
                        source: file,
                        time: plainMatch[1],
                        message: plainMatch[2],
                    }
                }

                return {
                    level: 'log',
                    source: file,
                    message: line,
                }
            }
        }

        const logs = readFileSync(LOG_FILE, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map(parseLogLine)
            .reverse()
            .slice(0, limit)

        return res.success({ logs, file, total: logs.length })
    }
}

export default LogsController;