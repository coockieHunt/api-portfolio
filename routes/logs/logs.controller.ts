import { readFileSync } from 'fs';
import type { Request, Response } from 'express';
import { bree } from '../../app';
import { logConsole, writeToLog } from '../../middlewares/log.middlewar';

class LogsController {
    async GetFallBackList(req: Request, res: Response) {
        const FALLBACK_INDEX = process.env.FALLBACK_CACHE_DIR + '/backup-log.json';
        
        try {
            const data = JSON.parse(readFileSync(FALLBACK_INDEX!, 'utf-8'));
            writeToLog("[Logs] Fallback cache list retrieved successfully.", "logs");
            logConsole('GET', '/logs/fallback/list', 'OK', 'Retrieved fallback cache list', { count: data.length });
            return res.success({ backups: data });
        } catch (error) {
            writeToLog("[Logs] Error reading fallback cache file:", "logs" );
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
            writeToLog("[Logs] Fallback log retrieved successfully.", "logs");
            logConsole('GET', '/logs/fallback/view', 'OK', 'Retrieved fallback log', { file: FALLBACK_DIR });
            return res.success({ log: data });
        } catch (error) {
            writeToLog(`[Logs] Error reading fallback log file ${FALLBACK_DIR}:`, "logs");
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

            writeToLog(`[Logs] Manual trigger: Job ${jobName} started.`, "logs");
            logConsole('POST', '/logs/fallback/force', 'OK', `Manual trigger: Job ${jobName} started.`, { jobName });
            return res.success({ message: "manual cache refresh started" });

        } catch (error: any) {
            if (error.message?.includes('already running')) {
                return res.error("job already running", 409);
            }

            writeToLog("[Logs] Bree fallback cache error:", "logs");
            logConsole('POST', '/logs/fallback/force', 'FAIL', 'Error during fallback cache build', { error });
            return res.error("error during fallback cache build", 500);
        }
    }
}

export default LogsController;