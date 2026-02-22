import { RedisClient } from '../../services/Redis.service.ts';
import { validateKey } from '../../utils/redis.helper.ts';
import { AUTHORIZED_REDIS_KEYS } from '../../constants/redis.constant.ts';
import { logConsole, writeToLog } from '../../middlewares/log.middlewar.ts';
import { NotFoundError } from '../../utils/AppError.ts';
import { GuestBookHelper } from './GuestBook.helper.ts';

interface GuestBookEntry {
    id: string;
    name: string;
    message: string;
    createdAt: string;
    authorized: boolean;
}

interface GuestBookResponseGet {
    meta: {
        total_count: number;
        page: number;
        limit: number;
        total_pages: number;
    };
    entries: GuestBookEntry[];
}

interface GuestBookDeleteResponse {
    success: boolean;
    meta: {
        id: string;
    };
    message: string;
}

export class GuestBookService {
    /**
     * Retrieves paginated guestbook entries from Redis
     * @param page - Page number (default: 1)
     * @param limit - Entries per page (default: 20)
     * @param isAuthenticated - Whether user is authenticated
     * @returns Promise with entries and pagination metadata
     * @throws {Error} If Redis client is not connected
     */
    static async getGuestBookEntries(page: number = 1, limit: number = 20, isAuthenticated: boolean = false): Promise<GuestBookResponseGet> {
        validateKey(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES);

        if (!GuestBookHelper.isRedisReady()) {
            throw new Error("Redis client is not connected.");
        }

        const start = (page - 1) * limit;
        const end = start + limit - 1;

        try {
            const [rawEntries, totalCount] = await Promise.all([
                RedisClient!.lRange(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES, start, end),
                RedisClient!.lLen(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES)
            ]);

            const entries: GuestBookEntry[] = rawEntries.map((entry) => {
                const parsed = GuestBookHelper.parseEntry(entry);
                if (!parsed) return null;

                if (!isAuthenticated && !parsed.authorized) {
                    return null;
                }

                return parsed;
            }).filter(entry => entry !== null) as GuestBookEntry[];

            writeToLog(`GuestBook READ page=${page} count=${entries.length}`, 'guestbook');

            return {
                meta: {
                    total_count: totalCount,
                    page: page,
                    limit: limit,
                    total_pages: Math.ceil(totalCount / limit)
                },
                entries: entries
            };
        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('GET', '/guestbook/', 'FAIL', 'Error getting guestbook entries', { error: errorMsg });
            writeToLog(`GuestBook READ error: ${errorMsg}`, 'guestbook');
            throw error;
        }
    }

    /**
     * Authorizes a guestbook entry by ID
     * @param id - Entry ID to authorize
     * @returns Promise with updated entry
     * @throws {NotFoundError} If entry not found
     */
    static async authorizeGuestBookEntry(id: string): Promise<GuestBookEntry> {
        validateKey(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES);

        if (!GuestBookHelper.isRedisReady()) {
            throw new Error("Redis client is not connected.");
        }

        const found = await GuestBookHelper.findEntryById(id);
        if (!found) {
            writeToLog(`GuestBook AUTHORIZE entry not found: id=${id}`, 'guestbook');
            throw new NotFoundError(`Guestbook entry with ID "${id}" not found`);
        }

        found.entry.authorized = true;
        await GuestBookHelper.updateEntryAuthStatus(found.index, found.entry);
        
        writeToLog(`GuestBook AUTHORIZE success: id=${id}`, 'guestbook');
        return found.entry;
    }

    /**
     * Unauthorizes a guestbook entry by ID
     * @param id - Entry ID to unauthorize
     * @returns Promise with updated entry
     * @throws {NotFoundError} If entry not found
     */
    static async unauthorizeGuestBookEntry(id: string): Promise<GuestBookEntry> {
        validateKey(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES);

        if (!GuestBookHelper.isRedisReady()) {
            throw new Error("Redis client is not connected.");
        }

        const found = await GuestBookHelper.findEntryById(id);
        if (!found) {
            writeToLog(`GuestBook UNAUTHORIZE entry not found: id=${id}`, 'guestbook');
            throw new NotFoundError(`Guestbook entry with ID "${id}" not found`);
        }

        found.entry.authorized = false;
        await GuestBookHelper.updateEntryAuthStatus(found.index, found.entry);
        
        writeToLog(`GuestBook UNAUTHORIZE success: id=${id}`, 'guestbook');
        return found.entry;
    }

    /**
     * Adds a new entry to the guestbook with HTML sanitization
     * @param name - The visitor's name
     * @param message - The guestbook message
     * @returns Promise with the created entry including generated ID
     * @throws {Error} If Redis client is not connected
     */
    static async addGuestBookEntry(name: string, message: string): Promise<GuestBookEntry> {
        validateKey(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES);

        if (!GuestBookHelper.isRedisReady()) {
            throw new Error("Redis client is not connected.");
        }

        try {
            const entryData: GuestBookEntry = {
                id: GuestBookHelper.generateId(),
                name: GuestBookHelper.escapeHtml(name.trim()), 
                message: GuestBookHelper.escapeHtml(message.trim()),
                createdAt: new Date().toISOString(),
                authorized: false
            };

            const entryString = JSON.stringify(entryData);

            console.log("Adding guestbook entry:", entryString);
            await RedisClient!.lPush(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES, entryString);
            
            writeToLog(`GuestBook WRITE success: by=${name.trim()} length=${message.trim().length} id=${entryData.id}`, 'guestbook');
            return entryData;
        } catch (error: any) {
            const errorMsg = error.stack || error.message || String(error);
            logConsole('POST', '/guestbook/', 'FAIL', 'Error adding guestbook entry', { error: errorMsg });
            writeToLog(`GuestBook WRITE error: ${errorMsg}`, 'guestbook');
            throw error;
        }
    }

    /**
     * Deletes a guestbook entry by its ID
     * @param id - The unique entry ID to delete
     * @returns Promise with deletion result and status
     * @throws {NotFoundError} If entry is not found
     */
    static async deleteGuestBookEntry(id: string): Promise<GuestBookDeleteResponse> {
        validateKey(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES);

        if (!GuestBookHelper.isRedisReady()) {
            throw new Error("Redis client is not connected.");
        }

        const allEntries = await RedisClient!.lRange(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES, 0, -1);
        
        let entryToDelete: string | null = null;
        
        for (const entry of allEntries) {
            const parsed = GuestBookHelper.parseEntry(entry);
            if (parsed && parsed.id === id) {
                entryToDelete = entry;
                break;
            }
        }
        
        if (!entryToDelete) {
            writeToLog(`GuestBook DELETE entry not found: id=${id}`, 'guestbook');
            throw new NotFoundError(`Guestbook entry with ID "${id}" not found`);
        }
        
        const removed = await GuestBookHelper.removeEntry(entryToDelete);
        
        if (removed <= 0) {
            writeToLog(`GuestBook DELETE failed: id=${id}`, 'guestbook');
            throw new NotFoundError(`Failed to delete guestbook entry with ID "${id}"`);
        }
        
        writeToLog(`GuestBook DELETE success: id=${id}`, 'guestbook');
        return {
            success: true,
            meta: {
                id: id
            },
            message: 'Entry deleted successfully',
        };
    }
}
