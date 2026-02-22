import { RedisClient } from '../Redis.service.ts';
import { AUTHORIZED_REDIS_KEYS } from '../../constants/redis.constant.ts';
import { writeToLog } from '../../middlewares/log.middlewar.ts';
import { NotFoundError } from '../../utils/AppError.ts';

interface GuestBookEntry {
    id: string;
    name: string;
    message: string;
    createdAt: string;
    authorized: boolean;
}

/**
 * GuestBook Helper
 * 
 * Helper utilities for GuestBook Service operations.
 */
export class GuestBookHelper {
    /**
     * Generates a unique ID for guestbook entries
     * @returns Unique identifier combining timestamp and random string
     */
    static generateId(): string {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Escapes HTML special characters to prevent XSS
     * @param text - Raw text to escape
     * @returns Escaped HTML-safe text
     */
    static escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Checks if Redis client is ready for operations
     * @returns True if Redis client is connected and ready
     */
    static isRedisReady(): boolean {
        return RedisClient !== undefined && RedisClient.isReady;
    }

    /**
     * Parses and validates a guestbook entry JSON string
     * @param entryString - Stringified JSON entry
     * @returns Parsed entry or null if parsing fails
     */
    static parseEntry(entryString: string): GuestBookEntry | null {
        try {
            const parsed = JSON.parse(entryString);
            if (!parsed.id) {
                parsed.id = `legacy-${Date.now()}`;
            }
            if (!parsed.createdAt) {
                parsed.createdAt = parsed.date || new Date().toISOString();
            }
            return parsed;
        } catch (e) {
            return null;
        }
    }

    /**
     * Finds a guestbook entry by ID in the list
     * @param id - Entry ID to find
     * @returns Object with index and entry, or null if not found
     */
    static async findEntryById(id: string): Promise<{ index: number; entry: GuestBookEntry } | null> {
        const allEntries = await RedisClient!.lRange(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES, 0, -1);
        
        for (let i = 0; i < allEntries.length; i++) {
            const parsed = this.parseEntry(allEntries[i]);
            if (parsed && parsed.id === id) {
                return { index: i, entry: parsed };
            }
        }
        
        return null;
    }

    /**
     * Updates an entry's authorization status in Redis
     * @param index - Index in Redis list
     * @param entry - Entry object with updated authorized status
     */
    static async updateEntryAuthStatus(index: number, entry: GuestBookEntry): Promise<void> {
        const updatedString = JSON.stringify(entry);
        await RedisClient!.lSet(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES, index, updatedString);
    }

    /**
     * Removes an entry from Redis list
     * @param entryString - Stringified entry to remove
     * @returns Number of elements removed
     */
    static async removeEntry(entryString: string): Promise<number> {
        return RedisClient!.lRem(AUTHORIZED_REDIS_KEYS.GUESTBOOK_ENTRIES, 1, entryString);
    }
}
