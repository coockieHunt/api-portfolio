import { readFileSync } from 'fs';
import type { Request, Response } from 'express';

class LogsController {
    async GetFallBackList(req: Request, res: Response) {
        const FALLBACK_INDEX = process.env.FALLBACK_CACHE_DIR + '/backup-log.json';
        
        try {
            const data = JSON.parse(readFileSync(FALLBACK_INDEX!, 'utf-8'));
            return res.success({ backups: data });
        } catch (error) {
            console.error("[Logs] Error reading fallback cache file:", error);
            return res.error("Failed to read fallback logs.", 500);
        }
    }

    async GetInfoByFilename(req: Request, res: Response) {
        const FALLBACK_DIR = process.env.FALLBACK_CACHE_DIR + "/worker_cache.json";

        try {
            const filePath = `${FALLBACK_DIR}`;
            const content = readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            return res.success({ log: data });
        } catch (error) {
            console.error(`[Logs] Error reading fallback log file ${FALLBACK_DIR}:`, error);
            return res.error("Failed to read fallback log.", 500);
        }
    }
}

export default LogsController;