import type {Request, Response} from 'express';
import { writeToLog, logConsole } from '../../middlewares/log.middlewar.ts';

const GATUS_API_URL = 'https://uptime.jonathangleyze.fr/api/v1/endpoints/statuses';

class GatusController {
    async getEndpoints(req: Request, res: Response) {
        try {
            const response = await fetch(GATUS_API_URL, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Portfolio-Backend/1.0',
                },
            });

            if (!response.ok) {
                logConsole('GET', '/gatus/endpoints', 'FAIL', `Gatus API error: ${response.status}`);
                writeToLog(`GatusRoute error: ${response.status}`, 'gatus');
                return res.status(response.status).json({
                    error: `Gatus API error: ${response.status}`,
                });
            }

            const data = await response.json() as any[];

            const transformedData = data.map((endpoint: any) => ({
                name: endpoint.name,
                group: endpoint.group,
                key: endpoint.key.replace(/^(backend_|frontend_|tools_)/, ''),
                results: endpoint.results.map((result: any) => ({
                    status: result.status,
                    success: result.success,
                    timestamp: result.timestamp,
                    duration: result.duration,
                })),
            }));

            logConsole('GET', '/gatus/endpoints', 'INFO', `Retrieved ${transformedData.length} endpoints`);
            writeToLog(`GatusRoute READ ok count=${transformedData.length}`, 'gatus');
            
            res.set('Cache-Control', 'public, max-age=300');
            return res.json(transformedData);
        } catch (error) {
            logConsole('GET', '/gatus/endpoints', 'FAIL', `Error fetching Gatus endpoints`, { error });
            writeToLog(`GatusRoute READ error`, 'gatus');
            return res.status(500).json({
                error: 'Failed to fetch Gatus endpoints',
            });
        }
    }
}

export default new GatusController();
