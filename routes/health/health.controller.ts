import type {Request, Response} from 'express';
import { logConsole, writeToLog } from '../../middlewares/log.middlewar.ts';
import { uptime } from 'node:process';
import { SendmailService } from '../../services/sendmail/Sendmail.service.ts';
import { RedisClient } from '../../services/Redis.service.ts';
import { pingSqlite } from '../../utils/sqllite.helper.ts';

class HealthController {
	/**
	 * GET / - Health Check Route
	 * Gets the health status of the API and its dependencies.
	 * @param req Express Request object
	 * @param res Express Response object
	 */
	async getStatus(req: Request, res: Response) {
		writeToLog('Health Check route accessed', 'health');
		logConsole('GET', '/health', 'INFO', 'Health Check route accessed');

		const healthStatus = {
			status: "ok",
			uptime: uptime(),
			timestamp: new Date().toISOString(),
			database: "down",
			redis: "down",
			mail: "down"
		};

		try {
			pingSqlite();
			healthStatus.database = 'UP';

			if (!RedisClient || !RedisClient.isReady) {
				throw new Error("Redis client not ready");
			}
			await RedisClient.ping();
			healthStatus.redis = 'UP';

			await SendmailService.verifySmtpConnection();
			healthStatus.mail = 'UP';

			return res.success(healthStatus);

		} catch (error: any) {
			const errorMsg = error.stack || error.message || String(error);
			logConsole('GET', '/health', 'FAIL', 'Health check failed', { error: errorMsg });
			writeToLog(`Health Check error: ${errorMsg}`, 'health');
			return res.error('Internal Server Error', 500);
		}
	}
}

export default new HealthController();
