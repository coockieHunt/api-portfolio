import consola from 'consola';
import { closeSqlite } from './utils/sqllite.helper';

let _server: any;
let _redisClient: any;
let _bree: any;
const connections = new Set<any>();
/** * Registers dependencies for the API, including the HTTP server, Redis client, and Bree instance.
 * Also sets up connection tracking for graceful shutdown.
 * @param server - The HTTP server instance to manage
 * @param redisClient - The Redis client instance to manage
 * @param bree - The Bree instance to manage
**/
export function registerDeps(server: any, redisClient: any, bree: any) {
    _server = server;
    _redisClient = redisClient;
    _bree = bree;

    server.on('connection', (conn: any) => {
        connections.add(conn);
        conn.on('close', () => connections.delete(conn));
    });
}

export async function apiShutdown(signal: string) {
    consola.warn(`[${signal}] shutdown...`);

    setTimeout(() => {
        consola.error('Forced shutdown timeout');
        process.exit(1);
    }, 5000).unref();

    try {
        for (const conn of connections) conn.destroy();

        await new Promise<void>(resolve => _server.close(() => resolve()));
        consola.success('HTTP server closed');

        await Promise.race([
            _bree.stop(),
            new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        consola.success('Bree stopped');

        if (_redisClient.isOpen) {
            await _redisClient.quit().catch(() => _redisClient.disconnect());
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